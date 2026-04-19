import { browserLocalJson } from "@/modules/inventory/services/storage";
import type { BankAccountEntry } from "./bank-account-ledger";
import { appendBankAccountEntry } from "./bank-account-ledger";
import type { CashBookEntry } from "./cash-book-ledger";
import { appendCashBookEntry } from "./cash-book-ledger";
import { dispatchFinancialLedgersUpdated } from "./financial-events";

const NS = { namespace: "seigen.financial", version: 1 as const };

/** Default COA-style codes used by CashBook tools (align with Settings → COA when wired). */
export const COA_CASH_CODE = "1010";
export const COA_BANK_CODE = "1020";
export const COA_AP_CODE = "2100";
export const COA_EQUITY_OPENING_CODE = "3100";
export const COA_MISC_INCOME_CODE = "4100";
/** Merchandise / stock on hand — paired with shrinkage or count gains on adjustments. */
export const COA_INVENTORY_ASSET_CODE = "1200";
/** P&L · shrinkage, damage, theft at standard cost (paired with CR inventory). */
export const COA_INVENTORY_SHRINKAGE_EXPENSE_CODE = "5180";
/** P&L · inventory overage from physical counts (paired with DR inventory). */
export const COA_INVENTORY_COUNT_GAIN_CODE = "4180";

export type JournalSource = "check" | "receipt" | "journal";

export type JournalLine = {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
};

export type JournalBatch = {
  id: string;
  createdAt: string;
  memo: string;
  source: JournalSource;
  lines: JournalLine[];
};

type Db = { batches: JournalBatch[] };

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function uid(): string {
  return `jrnl_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function getDb(): Db {
  const store = browserLocalJson(NS);
  if (!store) return { batches: [] };
  return store.read<Db>("general_journal", { batches: [] });
}

function setDb(db: Db) {
  const store = browserLocalJson(NS);
  if (!store) return;
  store.write("general_journal", db);
}

export function generalJournalStorageKey(): string {
  const store = browserLocalJson(NS);
  return store?.fullKey("general_journal") ?? "seigen.financial:v1:general_journal";
}

export function listJournalBatches(limit = 100): JournalBatch[] {
  return getDb()
    .batches.slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

/** Store a balanced journal batch without touching cash/bank sub-ledgers (caller posts those separately). */
export function appendJournalBatchRecordOnly(input: {
  memo: string;
  source: JournalSource;
  lines: JournalLine[];
}): { ok: true; batch: JournalBatch } | { ok: false; error: string } {
  const lines = input.lines.map((l) => ({
    accountCode: l.accountCode.trim(),
    accountName: l.accountName.trim() || l.accountCode.trim(),
    debit: roundMoney(l.debit),
    credit: roundMoney(l.credit),
  }));
  const v = validateBalanced(lines);
  if (!v.ok) return v;
  const batch: JournalBatch = {
    id: uid(),
    createdAt: new Date().toISOString(),
    memo: input.memo.trim() || "Journal",
    source: input.source,
    lines,
  };
  const db = getDb();
  db.batches.push(batch);
  setDb(db);
  dispatchFinancialLedgersUpdated();
  return { ok: true, batch };
}

function defaultLedgerKind(source: JournalSource): CashBookEntry["kind"] {
  if (source === "receipt") return "receipt";
  return "journal";
}

function validateBalanced(lines: JournalLine[]): { ok: true } | { ok: false; error: string } {
  if (lines.length < 2) return { ok: false, error: "Add at least two lines (debit and credit)." };
  let dr = 0;
  let cr = 0;
  for (const l of lines) {
    const d = roundMoney(l.debit);
    const c = roundMoney(l.credit);
    if (d < 0 || c < 0) return { ok: false, error: "Amounts cannot be negative." };
    if (d > 0 && c > 0) return { ok: false, error: "Each line must be either a debit or a credit, not both." };
    if (d === 0 && c === 0) return { ok: false, error: "Each line needs a non-zero debit or credit." };
    dr += d;
    cr += c;
  }
  if (roundMoney(dr) !== roundMoney(cr)) {
    return {
      ok: false,
      error: `Debits (${moneyFmt(dr)}) must equal credits (${moneyFmt(cr)}).`,
    };
  }
  return { ok: true };
}

function moneyFmt(n: number): string {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

/** Net asset movement for the cash sub-ledger: debits increase cash, credits decrease. */
export function netCashSubledgerDelta(lines: JournalLine[], cashCode: string): number {
  const code = cashCode.trim();
  let net = 0;
  for (const l of lines) {
    if (l.accountCode.trim() !== code) continue;
    net += roundMoney(l.debit) - roundMoney(l.credit);
  }
  return roundMoney(net);
}

export function netBankSubledgerDelta(lines: JournalLine[], bankCode: string): number {
  return netCashSubledgerDelta(lines, bankCode);
}

/**
 * Append a balanced journal batch and apply cash/bank lines to physical cash & bank ledgers.
 * Lines whose accountCode matches `cashCode` or `bankCode` update those ledgers; other lines are GL-only.
 */
export function appendBalancedJournalWithLedgers(input: {
  memo: string;
  source: JournalSource;
  lines: JournalLine[];
  cashCode?: string;
  bankCode?: string;
  cashEntryKind?: CashBookEntry["kind"];
  bankEntryKind?: BankAccountEntry["kind"];
}): { ok: true; batch: JournalBatch } | { ok: false; error: string } {
  const cashCode = input.cashCode ?? COA_CASH_CODE;
  const bankCode = input.bankCode ?? COA_BANK_CODE;
  const lines = input.lines.map((l) => ({
    accountCode: l.accountCode.trim(),
    accountName: l.accountName.trim() || l.accountCode.trim(),
    debit: roundMoney(l.debit),
    credit: roundMoney(l.credit),
  }));
  const v = validateBalanced(lines);
  if (!v.ok) return v;

  const cashNet = netCashSubledgerDelta(lines, cashCode);
  const bankNet = netCashSubledgerDelta(lines, bankCode);

  const batch: JournalBatch = {
    id: uid(),
    createdAt: new Date().toISOString(),
    memo: input.memo.trim() || "Journal",
    source: input.source,
    lines,
  };
  const db = getDb();
  db.batches.push(batch);
  setDb(db);

  const cashKind = input.cashEntryKind ?? defaultLedgerKind(input.source);
  const bankKind = input.bankEntryKind ?? (defaultLedgerKind(input.source) as BankAccountEntry["kind"]);

  if (cashNet !== 0) {
    appendCashBookEntry({
      memo: `${input.memo.trim() || "Journal"} · GL`,
      amount: cashNet,
      kind: cashKind,
    });
  }
  if (bankNet !== 0) {
    appendBankAccountEntry({
      memo: `${input.memo.trim() || "Journal"} · GL`,
      amount: bankNet,
      kind: bankKind,
    });
  }
  if (cashNet === 0 && bankNet === 0) {
    dispatchFinancialLedgersUpdated();
  }
  return { ok: true, batch };
}
