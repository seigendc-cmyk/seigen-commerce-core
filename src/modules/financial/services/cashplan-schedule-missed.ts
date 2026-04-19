import { balanceByCustomerId } from "@/modules/financial/services/debtors-ledger";
import { balanceBySupplierId } from "@/modules/financial/services/creditors-ledger";
import type { CreditorLedgerEntry } from "@/modules/financial/services/creditors-ledger";
import type { DebtorLedgerEntry } from "@/modules/financial/services/debtors-ledger";
import { effectiveDueDateKeyForSupplier } from "@/modules/financial/services/creditor-due";
import { effectiveCollectionDateKeyForCustomer } from "@/modules/financial/services/debtor-due";

/** Local calendar day YYYY-MM-DD (browser tz). */
export function localTodayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Outstanding balance with a commitment date before today = missed payment/collection.
 * Uses scheduled date when set, otherwise earliest open invoice due (same as calendar “effective” dates).
 */
export function isCreditorPaymentMissed(supplierId: string, creditorEntries: CreditorLedgerEntry[]): boolean {
  const bal = balanceBySupplierId().get(supplierId) ?? 0;
  if (bal <= 0) return false;
  const key = effectiveDueDateKeyForSupplier(supplierId, creditorEntries);
  if (!key) return false;
  return key < localTodayKey();
}

export function isDebtorCollectionMissed(customerId: string, debtorEntries: DebtorLedgerEntry[]): boolean {
  const bal = balanceByCustomerId().get(customerId) ?? 0;
  if (bal <= 0) return false;
  const key = effectiveCollectionDateKeyForCustomer(customerId, debtorEntries);
  if (!key) return false;
  return key < localTodayKey();
}
