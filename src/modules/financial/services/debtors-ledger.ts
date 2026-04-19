import { browserLocalJson } from "@/modules/inventory/services/storage";
import { dispatchFinancialLedgersUpdated } from "./financial-events";

const NS = { namespace: "seigen.financial", version: 1 as const };

export type DebtorEntryKind = "invoice" | "payment";

/**
 * AR subledger — mirrors creditors (AP): invoice increases what is owed; payment (credit) reduces it.
 * Double-entry pairing (e.g. to cash/revenue) is enforced at posting sites; this ledger is the AR leg.
 */
export type DebtorLedgerEntry = {
  id: string;
  createdAt: string;
  invoiceDate: string;
  dueDate: string;
  customerId: string;
  customerName: string;
  /** Document ref: invoice #, sale id suffix, etc. */
  reference: string;
  /** Invoice: positive AR. Payment: negative AR. */
  amount: number;
  entryKind?: DebtorEntryKind;
  /** Links payment lines to a settlement batch (symmetric to creditor paymentBatchId). */
  paymentBatchId?: string;
  /** Source invoice / credit sale id when applicable. */
  saleId?: string;
};

type Db = { entries: DebtorLedgerEntry[] };

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function uid(): string {
  return `deb_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function getDb(): Db {
  const store = browserLocalJson(NS);
  if (!store) return { entries: [] };
  return store.read<Db>("debtors_ar", { entries: [] });
}

function setDb(db: Db) {
  const store = browserLocalJson(NS);
  if (!store) return;
  store.write("debtors_ar", db);
}

function normalizeEntry(
  raw: Partial<DebtorLedgerEntry> &
    Pick<DebtorLedgerEntry, "id" | "createdAt" | "customerId" | "customerName" | "amount"> & {
      reference?: string;
    },
): DebtorLedgerEntry {
  const invoiceDate = raw.invoiceDate ?? raw.createdAt;
  let dueDate = raw.dueDate;
  if (!dueDate) {
    const d = new Date(invoiceDate);
    d.setDate(d.getDate() + 30);
    dueDate = d.toISOString();
  }
  const entryKind: DebtorEntryKind =
    raw.entryKind ?? (raw.amount < 0 ? "payment" : "invoice");
  return {
    id: raw.id,
    createdAt: raw.createdAt,
    invoiceDate,
    dueDate,
    customerId: raw.customerId,
    customerName: raw.customerName,
    reference: raw.reference?.trim() || "—",
    amount: raw.amount,
    entryKind,
    paymentBatchId: raw.paymentBatchId,
    saleId: raw.saleId,
  };
}

export function debtorsLedgerStorageKey(): string {
  const store = browserLocalJson(NS);
  return store?.fullKey("debtors_ar") ?? "seigen.financial:v1:debtors_ar";
}

export function listDebtorEntries(limit = 300): DebtorLedgerEntry[] {
  return getDb()
    .entries.map((e) => normalizeEntry(e))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export function listDebtorEntriesForCustomer(customerId: string): DebtorLedgerEntry[] {
  return getDb()
    .entries.filter((e) => e.customerId === customerId)
    .map((e) => normalizeEntry(e))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function balanceByCustomerId(): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of getDb().entries) {
    const prev = m.get(e.customerId) ?? 0;
    m.set(e.customerId, roundMoney(prev + e.amount));
  }
  return m;
}

export function totalDebtorsReceivables(): number {
  let s = 0;
  for (const v of balanceByCustomerId().values()) {
    if (v > 0) s += v;
  }
  return roundMoney(s);
}

export type OutstandingDebtorRow = {
  customerId: string;
  customerName: string;
  balance: number;
};

export function listOutstandingDebtors(): OutstandingDebtorRow[] {
  const rows: OutstandingDebtorRow[] = [];
  for (const [customerId, balance] of balanceByCustomerId()) {
    if (balance <= 0) continue;
    const entries = getDb().entries.filter((e) => e.customerId === customerId);
    const lastName =
      entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.customerName ?? customerId;
    rows.push({ customerId, customerName: lastName, balance });
  }
  return rows.sort((a, b) => b.balance - a.balance);
}

/** Credit sale / AR invoice: increases amount customer owes. Idempotent per sale id when provided. */
export function recordDebtorCreditInvoice(input: {
  customerId: string;
  customerName: string;
  amount: number;
  reference: string;
  saleId?: string;
  paymentTermsDays?: number;
}): void {
  const a = roundMoney(input.amount);
  if (a <= 0) return;
  const db = getDb();
  const sid = input.saleId?.trim();
  if (sid && db.entries.some((e) => e.saleId === sid && e.amount > 0)) return;
  const createdAt = new Date().toISOString();
  const invoiceDate = createdAt;
  const net = input.paymentTermsDays;
  const days = typeof net === "number" && net >= 0 ? Math.floor(net) : 30;
  const due = new Date(invoiceDate);
  due.setDate(due.getDate() + days);
  db.entries.push({
    id: uid(),
    createdAt,
    invoiceDate,
    dueDate: due.toISOString(),
    customerId: input.customerId,
    customerName: input.customerName.trim() || "Customer",
    reference: input.reference.trim() || "Invoice",
    amount: a,
    entryKind: "invoice",
    saleId: sid,
  });
  setDb(db);
  dispatchFinancialLedgersUpdated();
}

/** Customer payment against AR: negative amount (mirrors creditor payment entry). */
export function recordDebtorPaymentEntry(input: {
  customerId: string;
  customerName: string;
  amount: number;
  paymentBatchId: string;
  reference?: string;
}): void {
  const a = roundMoney(input.amount);
  if (a <= 0) return;
  const db = getDb();
  const createdAt = new Date().toISOString();
  db.entries.push({
    id: uid(),
    createdAt,
    invoiceDate: createdAt,
    dueDate: createdAt,
    customerId: input.customerId,
    customerName: input.customerName.trim() || "Customer",
    reference: input.reference?.trim() ? input.reference.trim() : `Payment · ${input.paymentBatchId.slice(-8)}`,
    amount: -a,
    entryKind: "payment",
    paymentBatchId: input.paymentBatchId,
  });
  setDb(db);
  dispatchFinancialLedgersUpdated();
}
