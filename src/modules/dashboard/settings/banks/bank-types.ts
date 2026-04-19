/** How this bank record connects to a service provider or data feed. */
export type BankServiceProvider =
  | "manual_entry"
  | "open_banking"
  | "bank_feed_aggregator"
  | "card_acquirer_settlement"
  | "other";

export type BankConnectionStatus = "draft" | "pending" | "connected" | "error" | "disconnected";

export type VendorBankAccount = {
  id: string;
  serviceProvider: BankServiceProvider;
  /** e.g. registered bank or fintech name. */
  institutionName: string;
  /** Branch or product line if relevant. */
  branchOrProduct: string;
  /** Friendly label in seiGEN. */
  accountLabel: string;
  /** Masked — store only safe identifiers until vault is wired. */
  accountIdentifierMasked: string;
  currency: string;
  connectionStatus: BankConnectionStatus;
  /** Reference from provider OAuth / consent (when connected). */
  providerExternalRef: string;
  notes: string;
};

export const BANK_SERVICE_PROVIDER_OPTIONS: { id: BankServiceProvider; label: string; description: string }[] = [
  {
    id: "manual_entry",
    label: "Manual entry",
    description: "Record bank details without an automated feed; you reconcile from statements.",
  },
  {
    id: "open_banking",
    label: "Open banking / PSD2-style",
    description: "Consent-based connection where available in your region.",
  },
  {
    id: "bank_feed_aggregator",
    label: "Bank feed aggregator",
    description: "Third-party aggregation (e.g. Plaid-style, Yodlee-style) when enabled for your workspace.",
  },
  {
    id: "card_acquirer_settlement",
    label: "Card acquirer settlement",
    description: "Settlement account as reported by your card processor.",
  },
  {
    id: "other",
    label: "Other provider",
    description: "Custom integration or regional banking API.",
  },
];

export function labelForBankProvider(id: BankServiceProvider): string {
  return BANK_SERVICE_PROVIDER_OPTIONS.find((o) => o.id === id)?.label ?? id;
}

export function emptyVendorBankAccount(id: string): VendorBankAccount {
  return {
    id,
    serviceProvider: "manual_entry",
    institutionName: "",
    branchOrProduct: "",
    accountLabel: "",
    accountIdentifierMasked: "",
    currency: "USD",
    connectionStatus: "draft",
    providerExternalRef: "",
    notes: "",
  };
}
