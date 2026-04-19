import { browserLocalJson } from "@/modules/inventory/services/storage";
import { dispatchFinancialLedgersUpdated } from "./financial-events";

const NS = { namespace: "seigen.financial", version: 1 as const };

import type { CostCenterCode } from "./cash-book-ledger";

export type BankAccountEntry = {
  id: string;
  createdAt: string;
  memo: string;
  /** Positive = deposit / in, negative = payment / out. */
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
  checkNumber?: string;
  checkDate?: string;
  payee?: string;
  costCenter?: CostCenterCode;
};

type Db = { entries: BankAccountEntry[] };

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function uid(): string {
  return `bnk_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function getDb(): Db {
  const store = browserLocalJson(NS);
  if (!store) return { entries: [] };
  return store.read<Db>("bank_account", { entries: [] });
}

function setDb(db: Db) {
  const store = browserLocalJson(NS);
  if (!store) return;
  store.write("bank_account", db);
}

export function bankAccountLedgerStorageKey(): string {
  const store = browserLocalJson(NS);
  return store?.fullKey("bank_account") ?? "seigen.financial:v1:bank_account";
}

export function listBankAccountEntries(limit = 200): BankAccountEntry[] {
  return getDb()
    .entries.slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export function bankAccountBalance(): number {
  const sum = getDb().entries.reduce((s, e) => s + e.amount, 0);
  return roundMoney(sum);
}

export function appendBankAccountEntry(
  entry: Omit<BankAccountEntry, "id" | "createdAt"> & { id?: string; createdAt?: string },
) {
  const db = getDb();
  const row: BankAccountEntry = {
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
