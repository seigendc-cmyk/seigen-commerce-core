import { describe, expect, it, vi } from "vitest";
import { readMoneyContextSnapshot } from "./money-context";

vi.mock("@/modules/financial/services/currency-settings", () => ({
  baseCurrencyCode: () => "KES",
}));

vi.mock("@/modules/financial/services/tax-settings", () => ({
  readTaxOnSalesSettings: () => ({
    enabled: true,
    ratePercent: 16,
    taxLabel: "VAT",
    pricesTaxInclusive: false,
    purchaseCostsTaxInclusive: false,
    applyTaxToDelivery: true,
    taxCollectorName: "",
    taxCollectorContact: "",
    taxContactPersonName: "",
    taxContactPersonContact: "",
  }),
}));

describe("money context snapshot", () => {
  it("normalizes currency and tax info into a reusable snapshot", () => {
    const mc = readMoneyContextSnapshot();
    expect(mc.currencyCode).toBe("KES");
    expect(mc.taxEnabled).toBe(true);
    expect(mc.taxLabel).toBe("VAT");
    expect(mc.taxRatePercent).toBe(16);
    expect(mc.taxInfo.toLowerCase()).toContain("vat");
    expect(mc.taxInfo.toLowerCase()).toContain("excl");
  });
});

