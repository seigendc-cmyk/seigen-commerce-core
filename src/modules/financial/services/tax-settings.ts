import { browserLocalJson } from "@/modules/inventory/services/storage";
import { dispatchFinancialLedgersUpdated } from "./financial-events";

const NS = { namespace: "seigen.financial", version: 1 as const };
const KEY = "tax_on_sales_settings";

export type TaxOnSalesSettings = {
  /** Master switch for POS output tax and purchase input tax postings. */
  enabled: boolean;
  /** Percentage, e.g. 15 for 15%. */
  ratePercent: number;
  /** Shown on receipts and ledger (VAT, GST, Sales tax). */
  taxLabel: string;
  /** POS shelf / line prices include this tax (tax extracted for reporting). */
  pricesTaxInclusive: boolean;
  /** PO unit costs include input tax (VAT inclusive); when false, tax is calculated on top of cost. */
  purchaseCostsTaxInclusive: boolean;
  /** Apply the same rate to delivery fee when > 0. */
  applyTaxToDelivery: boolean;
  /** Tax authority / collector (e.g. revenue service) — legal or registered name. */
  taxCollectorName: string;
  /** Collector phone, email, office address, or taxpayer reference as shown on filings. */
  taxCollectorContact: string;
  /** Your organisation’s primary contact for tax matters. */
  taxContactPersonName: string;
  /** Contact person phone, email, role, or other reach details. */
  taxContactPersonContact: string;
};

const MAX_NAME = 160;
const MAX_CONTACT_BLOCK = 800;

export const DEFAULT_TAX_ON_SALES_SETTINGS: TaxOnSalesSettings = {
  enabled: false,
  ratePercent: 15,
  taxLabel: "VAT",
  pricesTaxInclusive: true,
  purchaseCostsTaxInclusive: false,
  applyTaxToDelivery: true,
  taxCollectorName: "",
  taxCollectorContact: "",
  taxContactPersonName: "",
  taxContactPersonContact: "",
};

function getStore() {
  return browserLocalJson(NS);
}

export function taxOnSalesSettingsStorageKey(): string {
  const store = getStore();
  return store?.fullKey(KEY) ?? "seigen.financial:v1:tax_on_sales_settings";
}

export function readTaxOnSalesSettings(): TaxOnSalesSettings {
  const store = getStore();
  if (!store) return { ...DEFAULT_TAX_ON_SALES_SETTINGS };
  const raw = store.read<Partial<TaxOnSalesSettings> | null>(KEY, null);
  if (!raw || typeof raw !== "object") return { ...DEFAULT_TAX_ON_SALES_SETTINGS };
  return {
    enabled: raw.enabled === true,
    ratePercent:
      typeof raw.ratePercent === "number" && Number.isFinite(raw.ratePercent) && raw.ratePercent >= 0
        ? Math.min(100, raw.ratePercent)
        : DEFAULT_TAX_ON_SALES_SETTINGS.ratePercent,
    taxLabel:
      typeof raw.taxLabel === "string" && raw.taxLabel.trim()
        ? raw.taxLabel.trim().slice(0, 40)
        : DEFAULT_TAX_ON_SALES_SETTINGS.taxLabel,
    pricesTaxInclusive: raw.pricesTaxInclusive !== false,
    purchaseCostsTaxInclusive: raw.purchaseCostsTaxInclusive === true,
    applyTaxToDelivery: raw.applyTaxToDelivery !== false,
    taxCollectorName:
      typeof raw.taxCollectorName === "string"
        ? raw.taxCollectorName.trim().slice(0, MAX_NAME)
        : DEFAULT_TAX_ON_SALES_SETTINGS.taxCollectorName,
    taxCollectorContact:
      typeof raw.taxCollectorContact === "string"
        ? raw.taxCollectorContact.trim().slice(0, MAX_CONTACT_BLOCK)
        : DEFAULT_TAX_ON_SALES_SETTINGS.taxCollectorContact,
    taxContactPersonName:
      typeof raw.taxContactPersonName === "string"
        ? raw.taxContactPersonName.trim().slice(0, MAX_NAME)
        : DEFAULT_TAX_ON_SALES_SETTINGS.taxContactPersonName,
    taxContactPersonContact:
      typeof raw.taxContactPersonContact === "string"
        ? raw.taxContactPersonContact.trim().slice(0, MAX_CONTACT_BLOCK)
        : DEFAULT_TAX_ON_SALES_SETTINGS.taxContactPersonContact,
  };
}

export function writeTaxOnSalesSettings(patch: Partial<TaxOnSalesSettings>): TaxOnSalesSettings {
  const store = getStore();
  const next = { ...readTaxOnSalesSettings(), ...patch };
  if (store) store.write(KEY, next);
  dispatchFinancialLedgersUpdated();
  return next;
}

export function effectiveTaxRatePercent(): number {
  const s = readTaxOnSalesSettings();
  if (!s.enabled || s.ratePercent <= 0) return 0;
  return s.ratePercent;
}
