import { browserLocalJson } from "@/modules/inventory/services/storage";

const NS = { namespace: "seigen.pos", version: 1 as const };

/**
 * Line-level sales history columns mirroring catalog fields.
 * Cost and supplier are intentionally omitted — not user-toggleable.
 */
export const HISTORY_COLUMN_DEFS = [
  { id: "receiptNumber", label: "Receipt #", group: "sale" as const },
  { id: "saleDate", label: "Sale date", group: "sale" as const },
  { id: "saleStatus", label: "Status", group: "sale" as const },
  { id: "saleBranchId", label: "Sale branch", group: "sale" as const },
  { id: "surface", label: "Surface", group: "sale" as const },
  { id: "deliveryFee", label: "Delivery fee", group: "sale" as const },
  { id: "amountDue", label: "Amount due", group: "sale" as const },
  { id: "salesTaxAmount", label: "Sales tax", group: "sale" as const },
  { id: "totalPaid", label: "Total paid", group: "sale" as const },
  { id: "changeDue", label: "Change", group: "sale" as const },
  { id: "ideliverProviderName", label: "iDeliver provider", group: "sale" as const },
  { id: "paymentsSummary", label: "Payments", group: "sale" as const },
  { id: "sku", label: "SKU", group: "line" as const },
  { id: "name", label: "Product name", group: "line" as const },
  { id: "unit", label: "Unit", group: "line" as const },
  { id: "qty", label: "Qty", group: "line" as const },
  { id: "unitPrice", label: "Unit price", group: "line" as const },
  { id: "lineTotal", label: "Line total", group: "line" as const },
  { id: "lineTaxable", label: "Taxable line", group: "line" as const },
  { id: "productId", label: "Product ID", group: "catalog" as const },
  { id: "sectorLabel", label: "Sector", group: "catalog" as const },
  { id: "sectorId", label: "Sector ID", group: "catalog" as const },
  { id: "inventoryType", label: "Inventory type", group: "catalog" as const },
  { id: "locDepartment", label: "Dept", group: "catalog" as const },
  { id: "locShelf", label: "Shelf", group: "catalog" as const },
  { id: "locSite", label: "Site", group: "catalog" as const },
  { id: "barcode", label: "Barcode", group: "catalog" as const },
  { id: "upc", label: "UPC", group: "catalog" as const },
  { id: "brand", label: "Brand", group: "catalog" as const },
  { id: "description", label: "Description", group: "catalog" as const },
  { id: "productNotes", label: "Notes", group: "catalog" as const },
  { id: "currentSellingPrice", label: "Current list price", group: "catalog" as const },
  { id: "onHandQty", label: "On hand (now)", group: "catalog" as const },
  { id: "catalogBranchId", label: "Catalog branch", group: "catalog" as const },
  { id: "active", label: "Active (now)", group: "catalog" as const },
  { id: "forSale", label: "For sale (now)", group: "catalog" as const },
  { id: "reorderQty", label: "Reorder qty", group: "catalog" as const },
  { id: "alternativeProductId", label: "Alt product ID", group: "catalog" as const },
  { id: "flagExternalIdeliver", label: "External iDeliver", group: "catalog" as const },
] as const;

export type HistoryColumnId = (typeof HISTORY_COLUMN_DEFS)[number]["id"];

const PREFS_KEY = "historyTableColumns";

const DEFAULT_VISIBLE: HistoryColumnId[] = [
  "receiptNumber",
  "saleDate",
  "sku",
  "name",
  "unit",
  "qty",
  "unitPrice",
  "lineTotal",
  "sectorLabel",
  "saleStatus",
];

function isColumnId(s: string): s is HistoryColumnId {
  return HISTORY_COLUMN_DEFS.some((d) => d.id === s);
}

export function loadHistoryColumnVisibility(): Set<HistoryColumnId> {
  const store = browserLocalJson(NS);
  if (!store) return new Set(DEFAULT_VISIBLE);
  const raw = store.read<string[] | null>(PREFS_KEY, null);
  if (!raw || !Array.isArray(raw)) return new Set(DEFAULT_VISIBLE);
  const next = new Set<HistoryColumnId>();
  for (const x of raw) {
    if (typeof x === "string" && isColumnId(x)) next.add(x);
  }
  if (next.size === 0) return new Set(DEFAULT_VISIBLE);
  return next;
}

export function saveHistoryColumnVisibility(visible: Set<HistoryColumnId>) {
  const store = browserLocalJson(NS);
  if (!store) return;
  store.write(PREFS_KEY, [...visible]);
}

export function defaultHistoryColumns(): Set<HistoryColumnId> {
  return new Set(DEFAULT_VISIBLE);
}
