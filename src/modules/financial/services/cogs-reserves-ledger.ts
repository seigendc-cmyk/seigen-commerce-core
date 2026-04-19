import { browserLocalJson } from "@/modules/inventory/services/storage";
import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";
import { landUnitCostFromProduct } from "@/modules/financial/lib/cogs-cost";
import { dispatchFinancialLedgersUpdated } from "@/modules/financial/services/financial-events";
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

export type CogsReservesEntryKind =
  | "sale"
  | "po_cash"
  | "transfer_in_cash"
  | "transfer_in_bank"
  | "transfer_out_cash"
  | "creditor_payment";

/**
 * COGS reserve movements: POS sales (in), cash PO settlements (out), transfers with Cash/Bank.
 */
export type CogsReservesEntry = {
  id: string;
  createdAt: string;
  branchId: string;
  lines: CogsReservesLine[];
  /** Signed: positive adds to reserve, negative reduces (PO cash, transfers out). */
  totalCogs: number;
  saleId?: string;
  receiptNumber?: string;
  purchaseOrderId?: string;
  entryKind?: CogsReservesEntryKind;
  memo?: string;
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

function notifyLedgersUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(COGS_RESERVES_LEDGER_EVENT));
  dispatchFinancialLedgersUpdated();
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

/** Running COGS reserve balance (sales and transfers in minus PO cash and transfers out). */
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
    branchId: sale.branchId,
    lines,
    totalCogs,
    saleId: sale.id,
    receiptNumber: sale.receiptNumber,
    entryKind: "sale",
  });
  setDb(db);
  notifyLedgersUpdated();
}

/** Cash PO: pay supplier from COGS Reserves (reduces reserve). Idempotent per PO id. */
export function recordPurchaseCashFromCogsReserves(
  po: { id: string; branchId: string; reference?: string },
  amount: number,
): void {
  const a = roundMoney(amount);
  if (a <= 0) return;
  const db = getDb();
  if (db.entries.some((e) => e.purchaseOrderId === po.id && e.entryKind === "po_cash")) return;
  const label = po.reference?.trim() ? po.reference.trim() : po.id.slice(-8);
  db.entries.push({
    id: uid(),
    createdAt: new Date().toISOString(),
    branchId: po.branchId,
    lines: [],
    totalCogs: -a,
    purchaseOrderId: po.id,
    receiptNumber: `PO ${label}`,
    entryKind: "po_cash",
    memo: `Cash purchase · PO ${label}`,
  });
  setDb(db);
  notifyLedgersUpdated();
}

export function recordTransferInToCogsFromCash(amount: number, memo?: string): void {
  const a = roundMoney(amount);
  if (a <= 0) return;
  const branch = InventoryRepo.getDefaultBranch();
  const db = getDb();
  db.entries.push({
    id: uid(),
    createdAt: new Date().toISOString(),
    branchId: branch.id,
    lines: [],
    totalCogs: a,
    receiptNumber: "Cash → COGS",
    entryKind: "transfer_in_cash",
    memo: memo?.trim() || "Transfer in from Cash Book",
  });
  setDb(db);
  notifyLedgersUpdated();
}

export function recordTransferInToCogsFromBank(amount: number, memo?: string): void {
  const a = roundMoney(amount);
  if (a <= 0) return;
  const branch = InventoryRepo.getDefaultBranch();
  const db = getDb();
  db.entries.push({
    id: uid(),
    createdAt: new Date().toISOString(),
    branchId: branch.id,
    lines: [],
    totalCogs: a,
    receiptNumber: "Bank → COGS",
    entryKind: "transfer_in_bank",
    memo: memo?.trim() || "Transfer in from Bank",
  });
  setDb(db);
  notifyLedgersUpdated();
}

export function recordTransferOutFromCogsToCash(amount: number, memo?: string): void {
  const a = roundMoney(amount);
  if (a <= 0) return;
  const branch = InventoryRepo.getDefaultBranch();
  const db = getDb();
  db.entries.push({
    id: uid(),
    createdAt: new Date().toISOString(),
    branchId: branch.id,
    lines: [],
    totalCogs: -a,
    receiptNumber: "COGS → Cash",
    entryKind: "transfer_out_cash",
    memo: memo?.trim() || "Transfer out to Cash Book",
  });
  setDb(db);
  notifyLedgersUpdated();
}

/** Pay supplier AP from COGS Reserves (reduces reserve). */
export function recordCreditorSettlementFromCogs(totalAmount: number, batchId: string, memo: string): void {
  const a = roundMoney(totalAmount);
  if (a <= 0) return;
  const branch = InventoryRepo.getDefaultBranch();
  const db = getDb();
  db.entries.push({
    id: uid(),
    createdAt: new Date().toISOString(),
    branchId: branch.id,
    lines: [],
    totalCogs: -a,
    purchaseOrderId: `cogs_ap_${batchId}`,
    receiptNumber: `AP · ${batchId.slice(-10)}`,
    entryKind: "creditor_payment",
    memo: memo.trim() || "Creditor settlement from COGS Reserves",
  });
  setDb(db);
  notifyLedgersUpdated();
}
