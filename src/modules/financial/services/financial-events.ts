/** Fired when any browser-local financial ledger mutates (COGS, creditors, cash, bank). */
export const FINANCIAL_LEDGERS_UPDATED_EVENT = "seigen-financial-ledgers-updated";

export function dispatchFinancialLedgersUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(FINANCIAL_LEDGERS_UPDATED_EVENT));
}
