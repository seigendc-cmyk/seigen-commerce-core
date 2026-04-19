/** Posting category — drives normal balance and reporting bucket. */
export type AccountClass = "asset" | "liability" | "equity" | "revenue" | "expense" | "cogs";

/**
 * One row in the chart. Level 0 = top-level account; levels 1–3 are up to three nested subaccount levels
 * under that root (four tiers total: root + 3 sub-levels).
 */
export type CoaAccountRow = {
  id: string;
  parentId: string | null;
  code: string;
  name: string;
  class: AccountClass;
  /** 0 … 3 inclusive. */
  level: 0 | 1 | 2 | 3;
};

export const ACCOUNT_CLASS_OPTIONS: { id: AccountClass; label: string; normalBalance: "debit" | "credit" }[] = [
  { id: "asset", label: "Asset", normalBalance: "debit" },
  { id: "liability", label: "Liability", normalBalance: "credit" },
  { id: "equity", label: "Equity", normalBalance: "credit" },
  { id: "revenue", label: "Revenue", normalBalance: "credit" },
  { id: "cogs", label: "Cost of goods sold", normalBalance: "debit" },
  { id: "expense", label: "Expense", normalBalance: "debit" },
];

export function normalBalanceForClass(c: AccountClass): "debit" | "credit" {
  return ACCOUNT_CLASS_OPTIONS.find((o) => o.id === c)?.normalBalance ?? "debit";
}

export function labelForAccountClass(c: AccountClass): string {
  return ACCOUNT_CLASS_OPTIONS.find((o) => o.id === c)?.label ?? c;
}

export function emptyCoaRow(id: string, parent: CoaAccountRow | null): CoaAccountRow {
  const level = (parent ? parent.level + 1 : 0) as 0 | 1 | 2 | 3;
  return {
    id,
    parentId: parent?.id ?? null,
    code: "",
    name: "",
    class: parent?.class ?? "asset",
    level,
  };
}

export function canAddSubaccount(parent: CoaAccountRow): boolean {
  return parent.level < 3;
}

export function hasChildren(rows: CoaAccountRow[], id: string): boolean {
  return rows.some((r) => r.parentId === id);
}
