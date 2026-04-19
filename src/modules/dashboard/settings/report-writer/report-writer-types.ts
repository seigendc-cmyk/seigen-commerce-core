export type ScheduleFrequency = "daily" | "weekly" | "monthly" | "none";

export type ManagementReportTemplate = {
  id: string;
  name: string;
  description: string;
  /** Suggested column labels for the template (user can change after). */
  defaultColumns: string[];
  category: string;
};

export type SavedReportLayout = {
  id: string;
  name: string;
  /** Template this was derived from, if any. */
  templateId: string | null;
  columns: string[];
  dateRangePreset: string;
  branchScope: string;
  scheduleFrequency: ScheduleFrequency;
  scheduleDetail: string;
  exportXlsx: boolean;
  exportPdf: boolean;
};

export const DATE_RANGE_PRESETS: { id: string; label: string }[] = [
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "this_quarter", label: "This quarter" },
  { id: "ytd", label: "Year to date" },
  { id: "last_12m", label: "Rolling 12 months" },
  { id: "custom", label: "Custom range (when supported)" },
];

export const MANAGEMENT_REPORT_TEMPLATES: ManagementReportTemplate[] = [
  {
    id: "mgmt_pl",
    name: "P&L summary",
    description: "Revenue, COGS, gross margin, and operating expenses by period.",
    defaultColumns: ["Period", "Revenue", "COGS", "Gross profit", "OpEx", "Net income"],
    category: "Financial",
  },
  {
    id: "mgmt_balance",
    name: "Balance sheet snapshot",
    description: "Assets, liabilities, and equity as at a date.",
    defaultColumns: ["Account group", "Code", "Amount", "Variance vs prior"],
    category: "Financial",
  },
  {
    id: "mgmt_sales_branch",
    name: "Sales by branch",
    description: "Net sales, transactions, and average ticket by location.",
    defaultColumns: ["Branch", "Net sales", "Transactions", "Avg ticket", "vs prior %"],
    category: "Operations",
  },
  {
    id: "mgmt_inventory_valuation",
    name: "Inventory valuation",
    description: "On-hand quantity and extended cost by SKU or category.",
    defaultColumns: ["SKU", "Description", "Qty", "Unit cost", "Extended"],
    category: "Inventory",
  },
  {
    id: "mgmt_cash_movement",
    name: "Cash & bank movement",
    description: "Inflows, outflows, and closing position by account.",
    defaultColumns: ["Account", "Opening", "In", "Out", "Closing"],
    category: "Cash",
  },
  {
    id: "mgmt_aged_ar",
    name: "Aged receivables (when AR enabled)",
    description: "Outstanding balances by bucket — placeholder for future AR module.",
    defaultColumns: ["Customer", "Current", "30", "60", "90+", "Total"],
    category: "Financial",
  },
];

const ALL_COLUMN_OPTIONS = Array.from(
  new Set(MANAGEMENT_REPORT_TEMPLATES.flatMap((t) => t.defaultColumns).concat(["Branch", "Currency", "Notes"])),
).sort();

export const REPORT_COLUMN_OPTIONS: string[] = ALL_COLUMN_OPTIONS;

export function scheduleLabel(freq: ScheduleFrequency, detail: string): string {
  if (freq === "none") return "Not scheduled";
  const d = detail.trim() || "—";
  if (freq === "daily") return `Daily · ${d}`;
  if (freq === "weekly") return `Weekly · ${d}`;
  if (freq === "monthly") return `Monthly · ${d}`;
  return d;
}

export function emptySavedLayout(id: string): SavedReportLayout {
  return {
    id,
    name: "Untitled report",
    templateId: null,
    columns: ["Period", "Amount"],
    dateRangePreset: "this_month",
    branchScope: "all",
    scheduleFrequency: "none",
    scheduleDetail: "Mon 08:00",
    exportXlsx: true,
    exportPdf: true,
  };
}
