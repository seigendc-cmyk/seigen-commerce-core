import type { CreditorLedgerEntry } from "@/modules/financial/services/creditors-ledger";
import type { DebtorLedgerEntry } from "@/modules/financial/services/debtors-ledger";

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Standard buckets by days past due (invoice due date vs today, local midnight). */
export type AgeingBucketId = "not_yet_due" | "d1_30" | "d31_60" | "d61_90" | "d90_plus";

export type AgeingBucketTotals = Record<AgeingBucketId, number>;

export type AgeingEntityRow = {
  entityId: string;
  entityName: string;
  total: number;
  buckets: AgeingBucketTotals;
};

const ZERO: AgeingBucketTotals = {
  not_yet_due: 0,
  d1_30: 0,
  d31_60: 0,
  d61_90: 0,
  d90_plus: 0,
};

function startOfLocalDay(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function bucketForDueDate(dueIso: string, today: Date): AgeingBucketId {
  const due = new Date(dueIso.slice(0, 10) + "T12:00:00");
  if (Number.isNaN(due.getTime())) return "d1_30";
  const t0 = startOfLocalDay(today);
  const d0 = startOfLocalDay(due);
  if (d0 >= t0) return "not_yet_due";
  const daysLate = Math.floor((t0 - d0) / 86400000);
  if (daysLate <= 0) return "not_yet_due";
  if (daysLate <= 30) return "d1_30";
  if (daysLate <= 60) return "d31_60";
  if (daysLate <= 90) return "d61_90";
  return "d90_plus";
}

/**
 * FIFO-allocate payments (negative lines) against invoices (positive) in due-date order.
 * Returns remaining open invoice fragments with their invoice due dates.
 */
function fifoOpenInvoiceRemainders(entries: Array<{ amount: number; dueDate: string; createdAt: string; id: string }>): Array<{
  id: string;
  dueDate: string;
  remaining: number;
}> {
  const invoices = entries
    .filter((e) => e.amount > 0)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.createdAt.localeCompare(b.createdAt));
  let paymentPool = entries.filter((e) => e.amount < 0).reduce((s, e) => s + -e.amount, 0);
  const out: Array<{ id: string; dueDate: string; remaining: number }> = [];
  for (const inv of invoices) {
    const take = Math.min(inv.amount, paymentPool);
    const rem = roundMoney(inv.amount - take);
    paymentPool = roundMoney(paymentPool - take);
    if (rem > 1e-9) {
      out.push({ id: inv.id, dueDate: inv.dueDate, remaining: rem });
    }
  }
  return out;
}

function sumBuckets(rows: Array<{ dueDate: string; remaining: number }>, today: Date): AgeingBucketTotals {
  const b: AgeingBucketTotals = { ...ZERO };
  for (const r of rows) {
    const k = bucketForDueDate(r.dueDate, today);
    b[k] = roundMoney(b[k] + r.remaining);
  }
  return b;
}

export function ageingBucketsForCreditorSupplier(
  supplierId: string,
  entries: CreditorLedgerEntry[],
  today = new Date(),
): AgeingBucketTotals {
  const lines = entries
    .filter((e) => e.supplierId === supplierId)
    .map((e) => ({
      id: e.id,
      amount: e.amount,
      dueDate: e.dueDate,
      createdAt: e.createdAt,
    }));
  const remainders = fifoOpenInvoiceRemainders(lines);
  return sumBuckets(remainders, today);
}

export function ageingBucketsForDebtorCustomer(
  customerId: string,
  entries: DebtorLedgerEntry[],
  today = new Date(),
): AgeingBucketTotals {
  const lines = entries
    .filter((e) => e.customerId === customerId)
    .map((e) => ({
      id: e.id,
      amount: e.amount,
      dueDate: e.dueDate,
      createdAt: e.createdAt,
    }));
  const remainders = fifoOpenInvoiceRemainders(lines);
  return sumBuckets(remainders, today);
}

export function buildCreditorsAgeingReport(entries: CreditorLedgerEntry[], today = new Date()): AgeingEntityRow[] {
  const supplierIds = new Set<string>();
  for (const e of entries) {
    supplierIds.add(e.supplierId);
  }
  const rows: AgeingEntityRow[] = [];
  for (const supplierId of supplierIds) {
    const name =
      entries.find((e) => e.supplierId === supplierId)?.supplierName?.trim() || supplierId;
    const buckets = ageingBucketsForCreditorSupplier(supplierId, entries, today);
    const total = roundMoney(
      buckets.not_yet_due + buckets.d1_30 + buckets.d31_60 + buckets.d61_90 + buckets.d90_plus,
    );
    if (total <= 1e-9) continue;
    rows.push({ entityId: supplierId, entityName: name, total, buckets });
  }
  return rows.sort((a, b) => b.total - a.total);
}

export function buildDebtorsAgeingReport(entries: DebtorLedgerEntry[], today = new Date()): AgeingEntityRow[] {
  const customerIds = new Set<string>();
  for (const e of entries) {
    customerIds.add(e.customerId);
  }
  const rows: AgeingEntityRow[] = [];
  for (const customerId of customerIds) {
    const name =
      entries.find((e) => e.customerId === customerId)?.customerName?.trim() || customerId;
    const buckets = ageingBucketsForDebtorCustomer(customerId, entries, today);
    const total = roundMoney(
      buckets.not_yet_due + buckets.d1_30 + buckets.d31_60 + buckets.d61_90 + buckets.d90_plus,
    );
    if (total <= 1e-9) continue;
    rows.push({ entityId: customerId, entityName: name, total, buckets });
  }
  return rows.sort((a, b) => b.total - a.total);
}

export const AGEING_BUCKET_LABELS: Record<AgeingBucketId, string> = {
  not_yet_due: "Not yet due",
  d1_30: "1–30 days overdue",
  d31_60: "31–60 days",
  d61_90: "61–90 days",
  d90_plus: "90+ days",
};
