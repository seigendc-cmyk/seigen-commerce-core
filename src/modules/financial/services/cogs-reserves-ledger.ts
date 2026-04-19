import { browserLocalJson } from "@/modules/inventory/services/storage";
import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";
import { landUnitCostFromProduct } from "@/modules/financial/lib/cogs-cost";
import type { Sale, SaleLine } from "@/modules/pos/types/pos";

const NS = { namespace: "seigen.financial", version: 1 as const };

export type CogsReservesLine = {
  productId: string;
  sku: string;
  name: string;
  qty: number;
  unitCost: number;
  lineCogs: number;
};

/**
 * One posting: COGS isolated for a completed POS sale (cost layer — revenue stays in POS / cash).
 */
export type CogsReservesEntry = {
  id: string;
  createdAt: string;
  saleId: string;
  receiptNumber: string;
  branchId: string;
  lines: CogsReservesLine[];
  totalCogs: number;
};

type LedgerDb = { entries: CogsReservesEntry[] };

function uid(): string {
  return `cogs_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function getDb(): LedgerDb {
  const store = browserLocalJson(NS);
  if (!store) return { entries: [] };
  return store.read<LedgerDb>("cogs_reserves", { entries: [] });
}

function setDb(db: LedgerDb) {
  const store = browserLocalJson(NS);
  if (!store) return;
  store.write("cogs_reserves", db);
}

export const COGS_RESERVES_LEDGER_EVENT = "seigen-cogs-reserves-updated";

export function cogsReservesLedgerStorageKey(): string {
  const store = browserLocalJson(NS);
  return store?.fullKey("cogs_reserves") ?? "seigen.financial:v1:cogs_reserves";
}

export function listCogsReservesEntries(limit = 200): CogsReservesEntry[] {
  return getDb()
    .entries.slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

/** Sum of all posted COGS (running reserve). */
export function totalCogsReservesBalance(): number {
  const sum = getDb().entries.reduce((s, e) => s + e.totalCogs, 0);
  return roundMoney(sum);
}

function lineCogs(line: SaleLine): CogsReservesLine | null {
  const p = InventoryRepo.getProduct(line.productId);
  if (!p) return null;
  const unitCost = landUnitCostFromProduct(p);
  const lineCogs = roundMoney(unitCost * line.qty);
  return {
    productId: line.productId,
    sku: line.sku,
    name: line.name,
    qty: line.qty,
    unitCost,
    lineCogs,
  };
}

/**
 * Append a COGS Reserves entry for a completed sale. Idempotent per sale id (replaces if duplicate).
 */
export function recordCogsReservesFromSale(sale: Sale): void {
  if (sale.status !== "completed") return;
  const lines: CogsReservesLine[] = [];
  for (const sl of sale.lines) {
    const row = lineCogs(sl);
    if (row && row.lineCogs > 0) lines.push(row);
  }
  const totalCogs = roundMoney(lines.reduce((s, l) => s + l.lineCogs, 0));
  if (totalCogs <= 0) return;

  const db = getDb();
  db.entries = db.entries.filter((e) => e.saleId !== sale.id);
  db.entries.push({
    id: uid(),
    createdAt: sale.createdAt,
    saleId: sale.id,
    receiptNumber: sale.receiptNumber,
    branchId: sale.branchId,
    lines,
    totalCogs,
  });
  setDb(db);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(COGS_RESERVES_LEDGER_EVENT));
  }
}
