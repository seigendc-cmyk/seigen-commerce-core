import { listBiRules, type BiBusinessRule } from "@/modules/bi/services/bi-rules-local";
import { getCashPlanSnapshot } from "@/modules/cash-plan/services/cash-plan-snapshot";
import { countReservesUnderfunded } from "@/modules/cash-plan/services/cash-plan-reserves";
import { totalCogsReservesBalance } from "@/modules/financial/services/cogs-reserves-ledger";
import { totalOutputTax, totalInputTax } from "@/modules/financial/services/tax-ledger";

export type FinancialBiSignalSeverity = "info" | "notice" | "warning" | "critical";

export type FinancialBiSignal = {
  id: string;
  severity: FinancialBiSignalSeverity;
  title: string;
  detail: string;
  /** BI rule that contributed, when applicable */
  ruleKey?: string;
  source: "engine" | "bi_rule";
};

export type FinancialOverviewKpis = {
  cashOnHand: number;
  bankBalance: number;
  totalLiquidCash: number;
  cogsReservesBalance: number;
  supplierPayablesTotal: number;
  debtorReceivablesTotal: number;
  laybyeGoodsValue: number;
  cashPlanReservesTotal: number;
  indicativeCashAfterPayables: number;
  indicativeFreeCash: number;
  indicativeSpendableAfterCashPlanReserves: number;
  outputTaxTracked: number;
  inputTaxTracked: number;
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function moneyFmt(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

/**
 * Read-only rollups for Financial → Overview. Combines ledger math with active **financial** BI rules and heuristic signals.
 */
export function buildFinancialBiOverview(): {
  kpis: FinancialOverviewKpis;
  signals: FinancialBiSignal[];
  activeFinancialRules: BiBusinessRule[];
} {
  const snap = getCashPlanSnapshot();
  const cogs = totalCogsReservesBalance();
  const outTax = totalOutputTax();
  const inTax = totalInputTax();

  const kpis: FinancialOverviewKpis = {
    cashOnHand: roundMoney(snap.cashOnHand),
    bankBalance: roundMoney(snap.bankBalance),
    totalLiquidCash: roundMoney(snap.totalLiquidCash),
    cogsReservesBalance: roundMoney(cogs),
    supplierPayablesTotal: roundMoney(snap.supplierPayablesTotal),
    debtorReceivablesTotal: roundMoney(snap.debtorReceivablesTotal),
    laybyeGoodsValue: roundMoney(snap.laybyeGoodsValue),
    cashPlanReservesTotal: roundMoney(snap.cashPlanReservesTotal),
    indicativeCashAfterPayables: roundMoney(snap.indicativeCashAfterPayables),
    indicativeFreeCash: roundMoney(snap.indicativeFreeCash),
    indicativeSpendableAfterCashPlanReserves: roundMoney(snap.indicativeSpendableAfterCashPlanReserves),
    outputTaxTracked: roundMoney(outTax),
    inputTaxTracked: roundMoney(inTax),
  };

  const financialRules = listBiRules().filter((r) => r.domain === "financial");
  const activeFinancialRules = financialRules.filter((r) => r.isActive);

  const signals: FinancialBiSignal[] = [];

  const liquidityRule = activeFinancialRules.find((r) => r.ruleKey === "financial.liquidity_oversight");
  const reserveRule = activeFinancialRules.find((r) => r.ruleKey === "financial.cashplan_reserve_discipline");

  if (
    liquidityRule &&
    (liquidityRule.config as { criticalIfFreeCashNegative?: boolean })?.criticalIfFreeCashNegative !== false &&
    kpis.indicativeFreeCash < -1e-6
  ) {
    signals.push({
      id: "engine_free_cash_negative",
      severity: "critical",
      title: "Strict free cash is negative",
      detail: `Indicative free cash is ${moneyFmt(kpis.indicativeFreeCash)} after COGS pool and supplier AP. Review funding, payables, or sales mix.`,
      source: "engine",
    });
  }

  if (
    liquidityRule &&
    (liquidityRule.config as { warnIfPayablesExceedLiquid?: boolean })?.warnIfPayablesExceedLiquid !== false &&
    kpis.supplierPayablesTotal > kpis.totalLiquidCash + 1e-6
  ) {
    signals.push({
      id: "engine_ap_exceeds_liquid",
      severity: "warning",
      title: "Supplier payables exceed liquid cash",
      detail: `AP ${moneyFmt(kpis.supplierPayablesTotal)} vs cash + bank ${moneyFmt(kpis.totalLiquidCash)}. You may need COGS Reserves or supplier terms to settle.`,
      source: "engine",
    });
  }

  if (
    reserveRule &&
    (reserveRule.config as { flagUnderfundedReserves?: boolean })?.flagUnderfundedReserves !== false
  ) {
    const n = countReservesUnderfunded();
    if (n > 0) {
      signals.push({
        id: "engine_underfunded_reserves",
        severity: "notice",
        title: `${n} CashPlan reserve(s) underfunded or at risk`,
        detail: "Open CashPlan to review discipline buckets (rent, tax, salaries, etc.).",
        source: "engine",
      });
    }
  }

  if (kpis.cogsReservesBalance + 1e-6 < kpis.supplierPayablesTotal && kpis.supplierPayablesTotal > 1e-6) {
    signals.push({
      id: "engine_cogs_vs_ap",
      severity: "notice",
      title: "COGS Reserves below supplier payables",
      detail: `Seed balance ${moneyFmt(kpis.cogsReservesBalance)} vs AP ${moneyFmt(kpis.supplierPayablesTotal)} — ensure inventory funding matches credit exposure.`,
      source: "engine",
    });
  }

  signals.sort((a, b) => {
    const order: FinancialBiSignalSeverity[] = ["critical", "warning", "notice", "info"];
    return order.indexOf(a.severity) - order.indexOf(b.severity);
  });

  return { kpis, signals, activeFinancialRules };
}
