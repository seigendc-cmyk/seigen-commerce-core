import { baseCurrencyCode } from "@/modules/financial/services/currency-settings";
import { readTaxOnSalesSettings } from "@/modules/financial/services/tax-settings";

export type MoneyContextSnapshot = {
  currencyCode: string;
  taxEnabled: boolean;
  taxLabel: string;
  taxRatePercent: number;
  pricesTaxInclusive: boolean;
  /** Human display string (stable across outputs). */
  taxInfo: string;
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function readMoneyContextSnapshot(): MoneyContextSnapshot {
  const currencyCode = baseCurrencyCode();
  const ts = readTaxOnSalesSettings();
  const taxEnabled = ts.enabled && ts.ratePercent > 0;
  const taxRatePercent = roundMoney(Math.max(0, Number.isFinite(ts.ratePercent) ? ts.ratePercent : 0));
  const pricesTaxInclusive = ts.pricesTaxInclusive !== false;
  const taxLabel = (ts.taxLabel ?? "").trim() || "Tax";
  const taxInfo = taxEnabled
    ? `${taxLabel} ${taxRatePercent}% · ${pricesTaxInclusive ? "incl." : "excl."}`
    : `${taxLabel} · off`;
  return {
    currencyCode,
    taxEnabled,
    taxLabel,
    taxRatePercent,
    pricesTaxInclusive,
    taxInfo,
  };
}

