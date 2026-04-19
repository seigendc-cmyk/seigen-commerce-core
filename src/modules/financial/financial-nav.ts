export const FINANCIAL_DEFAULT_TAB = "seed" as const;

export type FinancialTabId = "seed" | "creditors" | "cashbook" | "stock-adjustments";

const TAB_SET = new Set<string>(["seed", "creditors", "cashbook", "stock-adjustments"]);

export function normalizeFinancialTab(raw: string | null): FinancialTabId {
  if (raw && TAB_SET.has(raw)) return raw as FinancialTabId;
  return FINANCIAL_DEFAULT_TAB;
}

export const FINANCIAL_TABS: { id: FinancialTabId; label: string; hint: string }[] = [
  {
    id: "seed",
    label: "Seed Account",
    hint: "COGS Reserves and sale cost layer",
  },
  {
    id: "creditors",
    label: "Creditors",
    hint: "Supplier payables from credit purchase orders",
  },
  {
    id: "cashbook",
    label: "CashBook",
    hint: "Cash and bank ledgers; fund COGS Reserves",
  },
  {
    id: "stock-adjustments",
    label: "Stock adjustments",
    hint: "Inventory corrections at cost; P&L via shrinkage and count gains",
  },
];
