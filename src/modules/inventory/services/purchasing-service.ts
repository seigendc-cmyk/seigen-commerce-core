import type { Id, PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus } from "../types/models";
import { InventoryRepo } from "./inventory-repo";
import { browserLocalJson } from "./storage";

const NS = { namespace: "seigen.inventory", version: 1 as const };

type PurchasingDb = {
  purchaseOrders: PurchaseOrder[];
};

function nowIso() {
  return new Date().toISOString();
}

function uid(prefix: string): Id {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function getPurchasingDb(): PurchasingDb {
  const store = browserLocalJson(NS);
  if (!store) return { purchaseOrders: [] };
  return store.read<PurchasingDb>("purchasing", { purchaseOrders: [] });
}

function setPurchasingDb(db: PurchasingDb) {
  const store = browserLocalJson(NS);
  if (!store) return;
  store.write("purchasing", db);
}

export const purchasingKeys = {
  purchasing: (() => {
    const store = browserLocalJson(NS);
    return store?.fullKey("purchasing") ?? `${NS.namespace}:v${NS.version}:purchasing`;
  })(),
};

export const PurchasingService = {
  listPurchaseOrders(): PurchaseOrder[] {
    return getPurchasingDb()
      .purchaseOrders.slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  getPurchaseOrder(id: Id): PurchaseOrder | undefined {
    return getPurchasingDb().purchaseOrders.find((po) => po.id === id);
  },
  createPurchaseOrder(input: {
    supplierId: Id;
    branchId?: Id;
    reference?: string;
    notes?: string;
  }): PurchaseOrder {
    const db = getPurchasingDb();
    const ts = nowIso();
    const branchId = input.branchId ?? InventoryRepo.getDefaultBranch().id;
    const po: PurchaseOrder = {
      id: uid("po"),
      supplierId: input.supplierId,
      branchId,
      status: "draft",
      reference: input.reference,
      notes: input.notes,
      items: [],
      createdAt: ts,
      updatedAt: ts,
    };
    db.purchaseOrders.push(po);
    setPurchasingDb(db);
    return po;
  },
  setStatus(poId: Id, status: PurchaseOrderStatus): PurchaseOrder {
    const db = getPurchasingDb();
    const po = db.purchaseOrders.find((x) => x.id === poId);
    if (!po) throw new Error("Purchase order not found");
    po.status = status;
    po.updatedAt = nowIso();
    setPurchasingDb(db);
    return po;
  },
  addItem(poId: Id, productId: Id): PurchaseOrder {
    const db = getPurchasingDb();
    const po = db.purchaseOrders.find((x) => x.id === poId);
    if (!po) throw new Error("Purchase order not found");
    const item: PurchaseOrderItem = {
      id: uid("poi"),
      productId,
      orderedQty: 1,
      expectedUnitCost: 0,
    };
    po.items.push(item);
    po.updatedAt = nowIso();
    setPurchasingDb(db);
    return po;
  },
  updateItem(
    poId: Id,
    itemId: Id,
    patch: Partial<Pick<PurchaseOrderItem, "orderedQty" | "expectedUnitCost">>,
  ): PurchaseOrder {
    const db = getPurchasingDb();
    const po = db.purchaseOrders.find((x) => x.id === poId);
    if (!po) throw new Error("Purchase order not found");
    const item = po.items.find((i) => i.id === itemId);
    if (!item) throw new Error("PO item not found");
    if (patch.orderedQty !== undefined) item.orderedQty = Math.max(0, patch.orderedQty);
    if (patch.expectedUnitCost !== undefined)
      item.expectedUnitCost = Math.max(0, patch.expectedUnitCost);
    po.updatedAt = nowIso();
    setPurchasingDb(db);
    return po;
  },
  removeItem(poId: Id, itemId: Id): PurchaseOrder {
    const db = getPurchasingDb();
    const po = db.purchaseOrders.find((x) => x.id === poId);
    if (!po) throw new Error("Purchase order not found");
    po.items = po.items.filter((i) => i.id !== itemId);
    po.updatedAt = nowIso();
    setPurchasingDb(db);
    return po;
  },
};
