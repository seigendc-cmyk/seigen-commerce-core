import type { GoodsReceipt, GoodsReceiptItem, Id } from "../types/models";
import { InventoryRepo } from "./inventory-repo";
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

export const ReceivingService = {
  listReceipts(): GoodsReceipt[] {
    return getReceivingDb()
      .receipts.slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  receiveAgainstPurchaseOrder(input: {
    purchaseOrderId: Id;
    receivedAt?: string;
    notes?: string;
    items: Array<{ productId: Id; receivedQty: number; unitCost: number }>;
  }): GoodsReceipt {
    const po = PurchasingService.getPurchaseOrder(input.purchaseOrderId);
    if (!po) throw new Error("Purchase order not found");

    const receiptItems: GoodsReceiptItem[] = input.items
      .filter((i) => i.receivedQty > 0)
      .map((i) => ({
        id: uid("gri"),
        productId: i.productId,
        receivedQty: Math.max(0, i.receivedQty),
        unitCost: Math.max(0, i.unitCost),
      }));

    const receipt: GoodsReceipt = {
      id: uid("grn"),
      purchaseOrderId: po.id,
      branchId: po.branchId,
      receivedAt: input.receivedAt ?? nowIso(),
      notes: input.notes,
      items: receiptItems,
      createdAt: nowIso(),
    };

    const db = getReceivingDb();
    db.receipts.push(receipt);
    setReceivingDb(db);

    // Stock updates.
    for (const item of receiptItems) {
      InventoryRepo.incrementStock(po.branchId, item.productId, item.receivedQty);
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
    const fullyReceived =
      po.items.length > 0 &&
      po.items.every((poi) => (receivedByProduct.get(poi.productId) ?? 0) >= poi.orderedQty);
    PurchasingService.setStatus(po.id, fullyReceived ? "received" : "ordered");

    return receipt;
  },
};
