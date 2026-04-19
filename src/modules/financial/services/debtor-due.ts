import type { DebtorLedgerEntry } from "@/modules/financial/services/debtors-ledger";
import { getScheduledDebtorCollectionDate } from "@/modules/financial/services/debtor-schedule";
import { isoToLocalDateKey } from "@/modules/financial/services/creditor-due";

export function effectiveCollectionDateKeyForCustomer(
  customerId: string,
  entries: DebtorLedgerEntry[],
): string | null {
  const scheduled = getScheduledDebtorCollectionDate(customerId);
  if (scheduled) {
    return isoToLocalDateKey(scheduled);
  }
  const invoices = entries.filter((e) => e.customerId === customerId && e.amount > 0);
  if (invoices.length === 0) return null;
  const earliest = [...invoices].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  return isoToLocalDateKey(earliest.dueDate);
}

export type DueDebtorRow = {
  customerId: string;
  customerName: string;
  balance: number;
  dueDateKey: string;
};

export function outstandingDebtorsWithDueDates(
  outstanding: Array<{ customerId: string; customerName: string; balance: number }>,
  entries: DebtorLedgerEntry[],
): DueDebtorRow[] {
  const rows: DueDebtorRow[] = [];
  for (const o of outstanding) {
    const dueDateKey = effectiveCollectionDateKeyForCustomer(o.customerId, entries);
    if (!dueDateKey) continue;
    rows.push({
      customerId: o.customerId,
      customerName: o.customerName,
      balance: o.balance,
      dueDateKey,
    });
  }
  return rows;
}
