import { browserLocalJson } from "@/modules/inventory/services/storage";
import { dispatchFinancialLedgersUpdated } from "./financial-events";

const NS = { namespace: "seigen.financial", version: 1 as const };

/** Cost centre for allocation (check writer, reporting). */
export type CostCenterCode = "shop" | "admin";

export type CashBookEntry = {
  id: string;
  createdAt: string;
  memo: string;
  /** Positive = cash in, negative = cash out. */
  amount: number;
  kind:
    | "opening"
    | "transfer_to_cogs"
    | "transfer_from_cogs"
    | "adjustment"
    | "ap_payment"
    | "check_payment"
    | "receipt"
    | "journal";
  /** Optional check / voucher metadata. */
  checkNumber?: string;
  /** Business date of the instrument (YYYY-MM-DD). */
  checkDate?: string;
  payee?: string;
  costCenter?: CostCenterCode;
};

type Db = { entries: CashBookEntry[] };

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function uid(): string {
  return `cash_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function getDb(): Db {
  const store = browserLocalJson(NS);
  if (!store) return { entries: [] };
  return store.read<Db>("cash_book", { entries: [] });
}

function setDb(db: Db) {
  const store = browserLocalJson(NS);
  if (!store) return;
  store.write("cash_book", db);
}

export function cashBookLedgerStorageKey(): string {
  const store = browserLocalJson(NS);
  return store?.fullKey("cash_book") ?? "seigen.financial:v1:cash_book";
}

export function listCashBookEntries(limit = 200): CashBookEntry[] {
  return getDb()
    .entries.slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export function cashBookBalance(): number {
  const sum = getDb().entries.reduce((s, e) => s + e.amount, 0);
  return roundMoney(sum);
}

export function appendCashBookEntry(entry: Omit<CashBookEntry, "id" | "createdAt"> & { id?: string; createdAt?: string }) {
  const db = getDb();
  const row: CashBookEntry = {
    id: entry.id ?? uid(),
    createdAt: entry.createdAt ?? new Date().toISOString(),
    memo: entry.memo,
    amount: roundMoney(entry.amount),
    kind: entry.kind,
  };
  if (entry.checkNumber?.trim()) row.checkNumber = entry.checkNumber.trim();
  if (entry.checkDate?.trim()) row.checkDate = entry.checkDate.trim();
  if (entry.payee?.trim()) row.payee = entry.payee.trim();
  if (entry.costCenter) row.costCenter = entry.costCenter;
  db.entries.push(row);
  setDb(db);
  dispatchFinancialLedgersUpdated();
}
