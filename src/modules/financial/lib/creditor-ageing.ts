import type { CreditorLedgerEntry } from "@/modules/financial/services/creditors-ledger";

function startOfDay(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/** Whole days from invoice date to as-of (for “invoice age” analysis). */
export function daysSinceInvoice(invoiceIso: string, asOf: Date): number {
  return Math.floor((startOfDay(asOf) - startOfDay(new Date(invoiceIso))) / 864e5);
}

/** Negative if not yet due — days until due is -daysPastDue when negative. */
export function daysPastDue(dueIso: string, asOf: Date): number {
  return Math.floor((startOfDay(asOf) - startOfDay(new Date(dueIso))) / 864e5);
}

export type DueBucketLabel =
  | "Not yet due"
  | "1–30 overdue"
  | "31–60 overdue"
  | "61–90 overdue"
  | "90+ overdue";

/** Bucket using **due date** vs today (typical AP ageing). */
export function dueDateBucket(dueIso: string, asOf: Date): DueBucketLabel {
  const past = daysPastDue(dueIso, asOf);
  if (past <= 0) return "Not yet due";
  if (past <= 30) return "1–30 overdue";
  if (past <= 60) return "31–60 overdue";
  if (past <= 90) return "61–90 overdue";
  return "90+ overdue";
}

/** Alternative: bucket by **invoice age** (days since invoice). */
export function invoiceAgeBucket(invoiceIso: string, asOf: Date): "0–30" | "31–60" | "61–90" | "90+" {
  const days = daysSinceInvoice(invoiceIso, asOf);
  if (days <= 30) return "0–30";
  if (days <= 60) return "31–60";
  if (days <= 90) return "61–90";
  return "90+";
}

export type CreditorAgeingRow = CreditorLedgerEntry & {
  daysPastDue: number;
  dueBucket: DueBucketLabel;
  invoiceAgeDays: number;
  invoiceAgeBucket: ReturnType<typeof invoiceAgeBucket>;
};

export function enrichCreditorEntriesForAgeing(entries: CreditorLedgerEntry[], asOf = new Date()): CreditorAgeingRow[] {
  return entries.map((e) => ({
    ...e,
    daysPastDue: daysPastDue(e.dueDate, asOf),
    dueBucket: dueDateBucket(e.dueDate, asOf),
    invoiceAgeDays: daysSinceInvoice(e.invoiceDate, asOf),
    invoiceAgeBucket: invoiceAgeBucket(e.invoiceDate, asOf),
  }));
}

export function sumByDueBucket(rows: CreditorAgeingRow[]): Record<DueBucketLabel, number> {
  const init: Record<DueBucketLabel, number> = {
    "Not yet due": 0,
    "1–30 overdue": 0,
    "31–60 overdue": 0,
    "61–90 overdue": 0,
    "90+ overdue": 0,
  };
  for (const r of rows) {
    init[r.dueBucket] = Math.round((init[r.dueBucket] + r.amount) * 100) / 100;
  }
  return init;
}
