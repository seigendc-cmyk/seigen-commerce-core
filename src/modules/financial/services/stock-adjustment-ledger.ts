import { browserLocalJson } from "@/modules/inventory/services/storage";
import { dispatchFinancialLedgersUpdated } from "./financial-events";
import { postAgentDebtorForShortage } from "@/modules/consignment/services/consignment-operations";

const NS = { namespace: "seigen.financial", version: 1 as const };

export type StockAdjustmentKind =
  | "physical_count"
  | "damage"
  | "theft"
  | "correction"
  | "other";

/**
 * Economic impact of physical counts at standard cost (average / unit cost).
 * Positive `valueImpact` = inventory value increased (overage); negative = shrinkage (P&L expense).
 */
export type StockAdjustmentLedgerEntry = {
  id: string;
  createdAt: string;
  branchId: string;
  stocktakeId: string;
  /** Short ref for tables (e.g. ST-abc123def45). */
  reference?: string;
  productId: string;
  sku: string;
  name: string;
  /** counted − system at post time */
  qtyVariance: number;
  unitCost: number;
  /** (counted − system) × unitCost — feeds inventory asset & offsetting P&L line in reporting */
  valueImpact: number;
  memo: string;
  /** Why the adjustment was recorded (defaults to physical count from stocktake). */
  adjustmentKind?: StockAdjustmentKind;
};

type Db = { entries: StockAdjustmentLedgerEntry[] };

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function uid(): string {
  return `stkadj_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function getDb(): Db {
  const store = browserLocalJson(NS);
  if (!store) return { entries: [] };
  return store.read<Db>("stock_adjustment_pl", { entries: [] });
}

function setDb(db: Db) {
  const store = browserLocalJson(NS);
  if (!store) return;
  store.write("stock_adjustment_pl", db);
}

export function stockAdjustmentLedgerStorageKey(): string {
  const store = browserLocalJson(NS);
  return store?.fullKey("stock_adjustment_pl") ?? "seigen.financial:v1:stock_adjustment_pl";
}

const KIND_SET = new Set<string>(["physical_count", "damage", "theft", "correction", "other"]);

function normalizeKind(raw: unknown): StockAdjustmentKind {
  return typeof raw === "string" && KIND_SET.has(raw) ? (raw as StockAdjustmentKind) : "physical_count";
}

function hydrateStockAdjustmentEntry(e: StockAdjustmentLedgerEntry): StockAdjustmentLedgerEntry {
  return {
    ...e,
    adjustmentKind: normalizeKind(e.adjustmentKind),
  };
}

/** Label for Financial → Stock adjustments table. */
export function labelStockAdjustmentKind(k: StockAdjustmentKind | undefined): string {
  switch (k ?? "physical_count") {
    case "physical_count":
      return "Physical count";
    case "damage":
      return "Damage / waste";
    case "theft":
      return "Theft / loss";
    case "correction":
      return "Correction";
    default:
      return "Other";
  }
}

export function listStockAdjustmentEntries(limit = 300): StockAdjustmentLedgerEntry[] {
  return getDb()
    .entries.slice()
    .map(hydrateStockAdjustmentEntry)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

/** Sum of value impacts (inventory asset movement at standard cost). */
export function totalStockAdjustmentValueImpact(): number {
  const sum = getDb().entries.reduce((s, e) => s + e.valueImpact, 0);
  return roundMoney(sum);
}

export function appendStockAdjustmentEntries(
  rows: Omit<StockAdjustmentLedgerEntry, "id" | "createdAt">[],
): void {
  if (rows.length === 0) return;
  const db = getDb();
  const ts = new Date().toISOString();
  for (const r of rows) {
    // Consignment shortage responsibility: negative variance at stall is agent liability at invoice value.
    if (r.qtyVariance < -1e-9) {
      const ref = r.reference?.trim() ? r.reference.trim() : r.stocktakeId.slice(-12);
      postAgentDebtorForShortage({
        stallBranchId: r.branchId,
        productId: r.productId,
        qtyShort: Math.abs(r.qtyVariance),
        reference: ref,
        createdAt: ts,
      });
    }
    db.entries.push({
      id: uid(),
      createdAt: ts,
      ...r,
      adjustmentKind: normalizeKind(r.adjustmentKind),
      qtyVariance: roundMoney(r.qtyVariance),
      unitCost: roundMoney(r.unitCost),
      valueImpact: roundMoney(r.valueImpact),
    });
  }
  setDb(db);
  dispatchFinancialLedgersUpdated();
}
