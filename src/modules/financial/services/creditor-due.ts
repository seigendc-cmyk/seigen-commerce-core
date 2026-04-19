import type { CreditorLedgerEntry } from "@/modules/financial/services/creditors-ledger";
import { getScheduledNextDueDate } from "@/modules/financial/services/creditor-schedule";

/** Local calendar day key YYYY-MM-DD */
export function isoToLocalDateKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Scheduled next due overrides earliest open invoice due date.
 */
export function effectiveDueDateKeyForSupplier(
  supplierId: string,
  entries: CreditorLedgerEntry[],
): string | null {
  const scheduled = getScheduledNextDueDate(supplierId);
  if (scheduled) {
    return isoToLocalDateKey(scheduled);
  }
  const invoices = entries.filter((e) => e.supplierId === supplierId && e.amount > 0);
  if (invoices.length === 0) return null;
  const earliest = [...invoices].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  return isoToLocalDateKey(earliest.dueDate);
}

export type DueCreditorRow = {
  supplierId: string;
  supplierName: string;
  balance: number;
  dueDateKey: string;
};

export function outstandingCreditorsWithDueDates(
  outstanding: Array<{ supplierId: string; supplierName: string; balance: number }>,
  entries: CreditorLedgerEntry[],
): DueCreditorRow[] {
  const rows: DueCreditorRow[] = [];
  for (const o of outstanding) {
    const dueDateKey = effectiveDueDateKeyForSupplier(o.supplierId, entries);
    if (!dueDateKey) continue;
    rows.push({
      supplierId: o.supplierId,
      supplierName: o.supplierName,
      balance: o.balance,
      dueDateKey,
    });
  }
  return rows;
}
