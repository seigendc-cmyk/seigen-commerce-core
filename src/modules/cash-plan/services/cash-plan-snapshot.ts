import { bankAccountBalance } from "@/modules/financial/services/bank-account-ledger";
import { cashBookBalance } from "@/modules/financial/services/cash-book-ledger";
import { totalCogsReservesBalance } from "@/modules/financial/services/cogs-reserves-ledger";
import { totalCreditorsPayables } from "@/modules/financial/services/creditors-ledger";
import { totalDebtorsReceivables } from "@/modules/financial/services/debtors-ledger";
import { totalCashPlanReserveBalances } from "@/modules/cash-plan/services/cash-plan-reserves";

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Local-first snapshot for CashPlan — wire to purchasing (AP), credit sales (AR), and laybye holds when those services post balances.
 * Extended fields are **read-only rollups** from existing Financial ledgers (no new postings or transaction rules).
 */
export type CashPlanSnapshot = {
  /** Accounts payable — amounts owed to suppliers (credit POs posted to the creditors ledger). */
  supplierPayablesTotal: number;
  /** Accounts receivable — amounts owed to you by customers on credit. */
  debtorReceivablesTotal: number;
  /** Retail value or cost basis of inventory reserved for laybye (policy-specific). */
  laybyeGoodsValue: number;

  /** Physical cash on hand (Cash Book ledger). */
  cashOnHand: number;
  /** Bank operating ledger balance. */
  bankBalance: number;
  /** Cash + bank — liquid position before allocation views. */
  totalLiquidCash: number;
  /** COGS Reserves (inventory funding pool) — same basis as Financial → Seed Account. */
  cogsReservesBalance: number;
  /**
   * max(0, totalLiquidCash − supplierPayablesTotal). Illustrative: cash left if all supplier AP were settled from
   * physical cash/bank (does not model paying from COGS Reserves).
   */
  indicativeCashAfterPayables: number;
  /**
   * max(0, totalLiquidCash − cogsReservesBalance − supplierPayablesTotal). Stricter discipline view: liquid cash after
   * notionally carving out the COGS pool and supplier AP (informational; not a ledger entry).
   */
  indicativeFreeCash: number;

  /**
   * CashPlan discipline reserves — earmarked in-app (local planning); does not split bank ledgers.
   * Additive to the snapshot; does not change {@link indicativeFreeCash}.
   */
  cashPlanReservesTotal: number;
  /**
   * max(0, indicativeFreeCash − cashPlanReservesTotal). Illustrative “safe to use” after both COGS carve-out,
   * supplier AP, and your own reserve earmarks.
   */
  indicativeSpendableAfterCashPlanReserves: number;
};

export function getCashPlanSnapshot(): CashPlanSnapshot {
  const supplierPayablesTotal = totalCreditorsPayables();
  const debtorReceivablesTotal = totalDebtorsReceivables();
  const cashOnHand = cashBookBalance();
  const bankBalance = bankAccountBalance();
  const totalLiquidCash = roundMoney(cashOnHand + bankBalance);
  const cogsReservesBalance = totalCogsReservesBalance();
  const indicativeCashAfterPayables = roundMoney(Math.max(0, totalLiquidCash - supplierPayablesTotal));
  const indicativeFreeCash = roundMoney(Math.max(0, totalLiquidCash - cogsReservesBalance - supplierPayablesTotal));
  const cashPlanReservesTotal = totalCashPlanReserveBalances();
  const indicativeSpendableAfterCashPlanReserves = roundMoney(
    Math.max(0, indicativeFreeCash - cashPlanReservesTotal),
  );

  return {
    supplierPayablesTotal,
    debtorReceivablesTotal,
    laybyeGoodsValue: 0,
    cashOnHand,
    bankBalance,
    totalLiquidCash,
    cogsReservesBalance,
    indicativeCashAfterPayables,
    indicativeFreeCash,
    cashPlanReservesTotal,
    indicativeSpendableAfterCashPlanReserves,
  };
}
