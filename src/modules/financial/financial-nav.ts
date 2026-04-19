export const FINANCIAL_DEFAULT_TAB = "seed" as const;

export type FinancialTabId = typeof FINANCIAL_DEFAULT_TAB;

const TAB_SET = new Set<string>(["seed"]);

export function normalizeFinancialTab(raw: string | null): FinancialTabId {
  if (raw && TAB_SET.has(raw)) return raw as FinancialTabId;
  return FINANCIAL_DEFAULT_TAB;
}

export const FINANCIAL_TABS: { id: FinancialTabId; label: string; hint: string }[] = [
  {
    id: "seed",
    label: "Seed Account",
    hint: "Local COGS reserve ledger (browser storage)",
  },
];
