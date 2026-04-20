import { computePurchaseOrderInputTax } from "@/modules/financial/lib/pos-sale-tax";
import { recordPurchaseCashFromCogsReserves } from "@/modules/financial/services/cogs-reserves-ledger";
import { recordCreditorCreditPurchase } from "@/modules/financial/services/creditors-ledger";
import { recordInputTaxFromPurchaseOrder } from "@/modules/financial/services/tax-ledger";
import type {
  Id,
  Product,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus,
  PurchasePaymentTerms,
} from "../types/models";
import { InventoryRepo } from "./inventory-repo";
import { browserLocalJson } from "./storage";

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Default PO unit cost from catalog: unit cost, then average cost if unit cost is unset/zero. */
export function defaultExpectedUnitCostFromProduct(product: Product | undefined): number {
  if (!product) return 0;
  const unit = product.costPrice;
  if (typeof unit === "number" && Number.isFinite(unit) && unit > 0) return roundMoney(unit);
  const avg = product.averageCost;
  if (typeof avg === "number" && Number.isFinite(avg) && avg > 0) return roundMoney(avg);
  if (typeof unit === "number" && Number.isFinite(unit) && unit >= 0) return roundMoney(unit);
  return 0;
}

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

const VALID_PO_STATUS = new Set<PurchaseOrderStatus>([
  "draft",
  "ordered",
  "partially_received",
  "received",
  "cancelled",
]);

export function normalizePurchaseOrder(po: PurchaseOrder): PurchaseOrder {
  const status: PurchaseOrderStatus = VALID_PO_STATUS.has(po.status as PurchaseOrderStatus)
    ? (po.status as PurchaseOrderStatus)
    : "ordered";
  return {
    ...po,
    paymentTerms: po.paymentTerms === "credit" ? "credit" : "cash",
    status,
  };
}

export function computePurchaseOrderTotal(po: PurchaseOrder): number {
  const t = po.items.reduce((s, it) => s + it.orderedQty * it.expectedUnitCost, 0);
  return roundMoney(t);
}

export const PurchasingService = {
  listPurchaseOrders(): PurchaseOrder[] {
    return getPurchasingDb()
      .purchaseOrders.map(normalizePurchaseOrder)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  getPurchaseOrder(id: Id): PurchaseOrder | undefined {
    const po = getPurchasingDb().purchaseOrders.find((p) => p.id === id);
    return po ? normalizePurchaseOrder(po) : undefined;
  },
  createPurchaseOrder(input: {
    supplierId: Id;
    branchId?: Id;
    reference?: string;
    notes?: string;
    paymentTerms?: PurchasePaymentTerms;
  }): PurchaseOrder {
    const db = getPurchasingDb();
    const ts = nowIso();
    const branchId = input.branchId ?? InventoryRepo.getDefaultTradingBranch()?.id ?? InventoryRepo.getDefaultBranch().id;
    const po: PurchaseOrder = {
      id: uid("po"),
      supplierId: input.supplierId,
      branchId,
      status: "draft",
      paymentTerms: input.paymentTerms === "credit" ? "credit" : "cash",
      reference: input.reference,
      notes: input.notes,
      items: [],
      createdAt: ts,
      updatedAt: ts,
    };
    db.purchaseOrders.push(po);
    setPurchasingDb(db);
    return normalizePurchaseOrder(po);
  },
  updatePaymentTerms(poId: Id, paymentTerms: PurchasePaymentTerms): PurchaseOrder {
    const db = getPurchasingDb();
    const po = db.purchaseOrders.find((x) => x.id === poId);
    if (!po) throw new Error("Purchase order not found");
    if (po.status !== "draft") throw new Error("Only draft purchase orders can change settlement.");
    po.paymentTerms = paymentTerms;
    po.updatedAt = nowIso();
    setPurchasingDb(db);
    return normalizePurchaseOrder(po);
  },
  /**
   * Mark draft PO ordered: credit → creditors ledger; cash → pay from COGS Reserves.
   */
  markOrdered(poId: Id): { ok: true; purchaseOrder: PurchaseOrder } | { ok: false; error: string } {
    const db = getPurchasingDb();
    const raw = db.purchaseOrders.find((x) => x.id === poId);
    if (!raw) return { ok: false, error: "Purchase order not found." };
    const po = normalizePurchaseOrder(raw);
    if (po.status !== "draft") return { ok: false, error: "Only draft purchase orders can be marked ordered." };
    const total = computePurchaseOrderTotal(po);
    if (po.items.length === 0 || total <= 0) {
      return { ok: false, error: "Add line items with quantity and unit cost before ordering." };
    }
    const supplier = InventoryRepo.getSupplier(po.supplierId);
    const supplierName = supplier?.name?.trim() ? supplier.name.trim() : "Supplier";
    if (po.paymentTerms === "credit") {
      const sup = InventoryRepo.getSupplier(po.supplierId);
      recordCreditorCreditPurchase(po, supplierName, total, {
        paymentTermsDays: sup?.paymentTermsDays,
      });
    } else {
      recordPurchaseCashFromCogsReserves(
        { id: po.id, branchId: po.branchId, reference: po.reference },
        total,
      );
    }
    const { inputTax, taxableBase } = computePurchaseOrderInputTax(po);
    if (inputTax > 0) {
      const label = po.reference?.trim() ? po.reference.trim() : po.id.slice(-8);
      recordInputTaxFromPurchaseOrder({
        purchaseOrderId: po.id,
        poReference: label,
        amount: inputTax,
        taxableBase,
      });
    }
    raw.status = "ordered";
    raw.updatedAt = nowIso();
    setPurchasingDb(db);
    return { ok: true, purchaseOrder: normalizePurchaseOrder(raw) };
  },
  setStatus(poId: Id, status: PurchaseOrderStatus): PurchaseOrder {
    const db = getPurchasingDb();
    const po = db.purchaseOrders.find((x) => x.id === poId);
    if (!po) throw new Error("Purchase order not found");
    po.status = status;
    po.updatedAt = nowIso();
    setPurchasingDb(db);
    return normalizePurchaseOrder(po);
  },
  addItem(poId: Id, productId: Id): PurchaseOrder {
    const db = getPurchasingDb();
    const po = db.purchaseOrders.find((x) => x.id === poId);
    if (!po) throw new Error("Purchase order not found");
    const product = InventoryRepo.getProduct(productId);
    const item: PurchaseOrderItem = {
      id: uid("poi"),
      productId,
      orderedQty: 1,
      expectedUnitCost: defaultExpectedUnitCostFromProduct(product),
    };
    po.items.push(item);
    po.updatedAt = nowIso();
    setPurchasingDb(db);
    return normalizePurchaseOrder(po);
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
    if (patch.orderedQty !== undefined) {
      const q = Number(patch.orderedQty);
      item.orderedQty = Number.isFinite(q) ? Math.max(0, Math.floor(q)) : 0;
    }
    if (patch.expectedUnitCost !== undefined) {
      const c = Number(patch.expectedUnitCost);
      item.expectedUnitCost = Number.isFinite(c) ? Math.max(0, roundMoney(c)) : 0;
    }
    po.updatedAt = nowIso();
    setPurchasingDb(db);
    return normalizePurchaseOrder(po);
  },
  removeItem(poId: Id, itemId: Id): PurchaseOrder {
    const db = getPurchasingDb();
    const po = db.purchaseOrders.find((x) => x.id === poId);
    if (!po) throw new Error("Purchase order not found");
    po.items = po.items.filter((i) => i.id !== itemId);
    po.updatedAt = nowIso();
    setPurchasingDb(db);
    return normalizePurchaseOrder(po);
  },
};
