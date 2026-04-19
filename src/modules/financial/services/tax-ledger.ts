import { browserLocalJson } from "@/modules/inventory/services/storage";
import { dispatchFinancialLedgersUpdated } from "./financial-events";
import { readTaxOnSalesSettings } from "./tax-settings";

const NS = { namespace: "seigen.financial", version: 1 as const };

export type TaxDirection = "output" | "input";

export type TaxLedgerEntry = {
  id: string;
  createdAt: string;
  direction: TaxDirection;
  /** Collected (output) or recoverable (input) tax amount — always ≥ 0. */
  amount: number;
  taxRatePercent: number;
  /** Net / taxable base this tax relates to (goods, or purchase taxable base). */
  taxableBase: number;
  refKind: "sale" | "purchase_order";
  refId: string;
  memo: string;
};

type Db = { entries: TaxLedgerEntry[] };

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function uid(): string {
  return `tax_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function getDb(): Db {
  const store = browserLocalJson(NS);
  if (!store) return { entries: [] };
  return store.read<Db>("tax_ledger", { entries: [] });
}

function setDb(db: Db) {
  const store = browserLocalJson(NS);
  if (!store) return;
  store.write("tax_ledger", db);
}

export function taxLedgerStorageKey(): string {
  const store = browserLocalJson(NS);
  return store?.fullKey("tax_ledger") ?? "seigen.financial:v1:tax_ledger";
}

export function listTaxLedgerEntries(limit = 300): TaxLedgerEntry[] {
  return getDb()
    .entries.slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export function totalOutputTax(): number {
  const sum = getDb().entries.filter((e) => e.direction === "output").reduce((s, e) => s + e.amount, 0);
  return roundMoney(sum);
}

export function totalInputTax(): number {
  const sum = getDb().entries.filter((e) => e.direction === "input").reduce((s, e) => s + e.amount, 0);
  return roundMoney(sum);
}

function replaceByRef(kind: TaxLedgerEntry["refKind"], refId: string, entry: TaxLedgerEntry) {
  const db = getDb();
  db.entries = db.entries.filter((e) => !(e.refKind === kind && e.refId === refId));
  db.entries.push(entry);
  setDb(db);
  dispatchFinancialLedgersUpdated();
}

/**
 * Output tax from retail sales (POS). Idempotent per sale id.
 */
export function recordOutputTaxFromSale(input: {
  saleId: string;
  receiptNumber: string;
  amount: number;
  taxableBase: number;
  createdAt?: string;
}): void {
  const settings = readTaxOnSalesSettings();
  if (!settings.enabled) return;
  const a = roundMoney(input.amount);
  if (a <= 0) return;
  const base = roundMoney(input.taxableBase);
  const entry: TaxLedgerEntry = {
    id: uid(),
    createdAt: input.createdAt ?? new Date().toISOString(),
    direction: "output",
    amount: a,
    taxRatePercent: settings.ratePercent,
    taxableBase: base,
    refKind: "sale",
    refId: input.saleId,
    memo: `Output ${settings.taxLabel} · ${input.receiptNumber}`,
  };
  replaceByRef("sale", input.saleId, entry);
}

/**
 * Input tax on taxable purchase lines (credit PO or cash from COGS). Idempotent per PO id.
 */
export function recordInputTaxFromPurchaseOrder(input: {
  purchaseOrderId: string;
  poReference: string;
  amount: number;
  taxableBase: number;
  createdAt?: string;
}): void {
  const settings = readTaxOnSalesSettings();
  if (!settings.enabled) return;
  const a = roundMoney(input.amount);
  if (a <= 0) return;
  const base = roundMoney(input.taxableBase);
  const entry: TaxLedgerEntry = {
    id: uid(),
    createdAt: input.createdAt ?? new Date().toISOString(),
    direction: "input",
    amount: a,
    taxRatePercent: settings.ratePercent,
    taxableBase: base,
    refKind: "purchase_order",
    refId: input.purchaseOrderId,
    memo: `Input ${settings.taxLabel} · PO ${input.poReference}`,
  };
  replaceByRef("purchase_order", input.purchaseOrderId, entry);
}
