import { totalCreditorsPayables } from "@/modules/financial/services/creditors-ledger";
import { totalDebtorsReceivables } from "@/modules/financial/services/debtors-ledger";

/**
 * Local-first snapshot for CashPlan — wire to purchasing (AP), credit sales (AR), and laybye holds when those services post balances.
 */
export type CashPlanSnapshot = {
  /** Accounts payable — amounts owed to suppliers (credit POs posted to the creditors ledger). */
  supplierPayablesTotal: number;
  /** Accounts receivable — amounts owed to you by customers on credit. */
  debtorReceivablesTotal: number;
  /** Retail value or cost basis of inventory reserved for laybye (policy-specific). */
  laybyeGoodsValue: number;
};

export function getCashPlanSnapshot(): CashPlanSnapshot {
  return {
    supplierPayablesTotal: totalCreditorsPayables(),
    debtorReceivablesTotal: totalDebtorsReceivables(),
    laybyeGoodsValue: 0,
  };
}