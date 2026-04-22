import type { GoodsReceipt, GoodsReceiptItem, Id, PurchaseOrderStatus } from "../types/models";
import { branchAllowsStockOperations, InventoryRepo, isHeadOfficeBranch } from "./inventory-repo";
import { PurchasingService } from "./purchasing-service";
import { browserLocalJson } from "./storage";

const NS = { namespace: "seigen.inventory", version: 1 as const };

type ReceivingDb = {
  receipts: GoodsReceipt[];
};

function nowIso() {
  return new Date().toISOString();
}

function uid(prefix: string): Id {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function getReceivingDb(): ReceivingDb {
  const store = browserLocalJson(NS);
  if (!store) return { receipts: [] };
  return store.read<ReceivingDb>("receiving", { receipts: [] });
}

function setReceivingDb(db: ReceivingDb) {
  const store = browserLocalJson(NS);
  if (!store) return;
  store.write("receiving", db);
}

export const receivingKeys = {
  receiving: (() => {
    const store = browserLocalJson(NS);
    return store?.fullKey("receiving") ?? `${NS.namespace}:v${NS.version}:receiving`;
  })(),
};

/** Cumulative received qty per product for a PO (all receipts). */
export function getReceivedQtyByProductForPo(purchaseOrderId: Id): Map<Id, number> {
  const receivedByProduct = new Map<Id, number>();
  for (const r of getReceivingDb().receipts) {
    if (r.purchaseOrderId !== purchaseOrderId) continue;
    for (const it of r.items) {
      receivedByProduct.set(it.productId, (receivedByProduct.get(it.productId) ?? 0) + it.receivedQty);
    }
  }
  return receivedByProduct;
}

/** Inbound stock is transactional here; purchase orders do not change on-hand until receipt lines post. */
export const ReceivingService = {
  listReceipts(): GoodsReceipt[] {
    return getReceivingDb()
      .receipts.slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  getReceivedQtyByProductForPo,

  receiveAgainstPurchaseOrder(input: {
    purchaseOrderId: Id;
    /** Stock is posted to this branch (warehouse / shop). Defaults to the PO branch. */
    branchId?: Id;
    receivedAt?: string;
    notes?: string;
    items: Array<{ productId: Id; receivedQty: number; unitCost: number }>;
  }): GoodsReceipt {
    const po = PurchasingService.getPurchaseOrder(input.purchaseOrderId);
    if (!po) throw new Error("Purchase order not found");
    if (po.status === "draft") {
      throw new Error("Mark the purchase order as ordered in Purchasing before receiving.");
    }
    if (po.status === "cancelled") {
      throw new Error("This purchase order is cancelled.");
    }
    if (po.status === "received") {
      throw new Error("This purchase order is already fully received.");
    }
    if (po.items.length === 0) {
      throw new Error("Purchase order has no line items.");
    }

    const priorReceived = getReceivedQtyByProductForPo(po.id);
    for (const i of input.items) {
      if (i.receivedQty <= 0) continue;
      const line = po.items.find((p) => p.productId === i.productId);
      if (!line) {
        throw new Error("A receive line does not match this purchase order.");
      }
      const prior = priorReceived.get(i.productId) ?? 0;
      const remaining = line.orderedQty - prior;
      if (i.receivedQty > remaining) {
        throw new Error(
          `Receive quantity exceeds remaining open qty for a line (${remaining} remaining).`,
        );
      }
    }

    const receiptItems: GoodsReceiptItem[] = input.items
      .filter((i) => i.receivedQty > 0)
      .map((i) => ({
        id: uid("gri"),
        productId: i.productId,
        receivedQty: Math.max(0, i.receivedQty),
        unitCost: Math.max(0, i.unitCost),
      }));

    if (receiptItems.length === 0) {
      throw new Error("Enter at least one line with quantity greater than zero.");
    }

    const targetBranchId = input.branchId ?? po.branchId;
    const branch = InventoryRepo.getBranch(targetBranchId);
    if (!branch) {
      throw new Error("Select a valid warehouse / shop to receive into.");
    }
    if (isHeadOfficeBranch(branch) || !branchAllowsStockOperations(branch)) {
      throw new Error("Receiving cannot post stock into Head office. Select a warehouse or trading shop.");
    }

    const receipt: GoodsReceipt = {
      id: uid("grn"),
      purchaseOrderId: po.id,
      branchId: targetBranchId,
      receivedAt: input.receivedAt ?? nowIso(),
      notes: input.notes,
      items: receiptItems,
      createdAt: nowIso(),
    };

    const db = getReceivingDb();
    db.receipts.push(receipt);
    setReceivingDb(db);

    // Inventory: only receiving increments on-hand (PO itself is non-stock).
    for (const item of receiptItems) {
      InventoryRepo.incrementStock(targetBranchId, item.productId, item.receivedQty);
    }

    // If all items received (simple rule), mark PO received.
    // We consider "received" once at least one receipt exists and all orderedQty are <= cumulative receivedQty.
    const receiptsForPo = db.receipts.filter((r) => r.purchaseOrderId === po.id);
    const receivedByProduct = new Map<Id, number>();
    for (const r of receiptsForPo) {
      for (const it of r.items) {
        receivedByProduct.set(it.productId, (receivedByProduct.get(it.productId) ?? 0) + it.receivedQty);
      }
    }
    const fullyReceived = po.items.every(
      (poi) => (receivedByProduct.get(poi.productId) ?? 0) >= poi.orderedQty,
    );
    const nextStatus: PurchaseOrderStatus = fullyReceived ? "received" : "partially_received";
    PurchasingService.setStatus(po.id, nextStatus);

    return receipt;
  },
};
