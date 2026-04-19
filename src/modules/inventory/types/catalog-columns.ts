import type { ProductReadModel } from "./product-read-model";

/** Columns backed by ProductReadModel; "actions" is synthetic for the table. */
export const CATALOG_DATA_COLUMN_IDS = [
  "primaryImage",
  "sku",
  "name",
  "sectorLabel",
  "sectorId",
  "unit",
  "barcode",
  "brand",
  "costPrice",
  "sellingPrice",
  "onHandQty",
  "active",
  "ideliverExternal",
  "branchId",
  "id",
] as const;

export type CatalogDataColumnId = (typeof CATALOG_DATA_COLUMN_IDS)[number];

export const CATALOG_COLUMN_LABELS: Record<CatalogDataColumnId | "actions", string> = {
  primaryImage: "Image",
  sku: "SKU",
  name: "Name",
  sectorLabel: "Sector",
  sectorId: "Sector ID",
  unit: "Unit",
  barcode: "Barcode",
  brand: "Brand",
  costPrice: "Cost",
  sellingPrice: "Sell",
  onHandQty: "Stock",
  active: "Active",
  ideliverExternal: "External iDeliver",
  branchId: "Branch",
  id: "Internal ID",
  actions: "Actions",
};

/** Canonical ordering when merging / resetting. */
export const CATALOG_MASTER_COLUMN_ORDER: CatalogDataColumnId[] = [...CATALOG_DATA_COLUMN_IDS];

export const CATALOG_DEFAULT_VISIBLE: CatalogDataColumnId[] = [
  "primaryImage",
  "sku",
  "name",
  "sectorLabel",
  "unit",
  "costPrice",
  "sellingPrice",
  "onHandQty",
  "active",
  "ideliverExternal",
];

export const CATALOG_COLUMN_PREFS_KEY = "seigen.inventory:v1:catalog_columns";

/** Ordered list of visible data columns (left → right). */
export type CatalogColumnPrefs = {
  columns: CatalogDataColumnId[];
};

export function defaultVisibleColumnOrder(): CatalogDataColumnId[] {
  return CATALOG_MASTER_COLUMN_ORDER.filter((c) => CATALOG_DEFAULT_VISIBLE.includes(c));
}

export function normalizeSavedColumns(saved: CatalogDataColumnId[] | undefined | null): CatalogDataColumnId[] {
  const allowed = new Set<string>(CATALOG_DATA_COLUMN_IDS);
  if (!saved?.length) return defaultVisibleColumnOrder();

  const seen = new Set<string>();
  const out: CatalogDataColumnId[] = [];
  for (const c of saved) {
    if (allowed.has(c) && !seen.has(c)) {
      seen.add(c);
      out.push(c);
    }
  }
  return out.length ? out : defaultVisibleColumnOrder();
}
