import {
  CATALOG_COLUMN_PREFS_KEY,
  type CatalogColumnPrefs,
  type CatalogDataColumnId,
  normalizeSavedColumns,
} from "../types/catalog-columns";

export function readCatalogColumnPrefs(): CatalogDataColumnId[] {
  if (typeof window === "undefined") return normalizeSavedColumns(undefined);
  try {
    const raw = window.localStorage.getItem(CATALOG_COLUMN_PREFS_KEY);
    if (!raw) return normalizeSavedColumns(undefined);
    const parsed = JSON.parse(raw) as CatalogColumnPrefs;
    return normalizeSavedColumns(parsed.columns);
  } catch {
    return normalizeSavedColumns(undefined);
  }
}

export function writeCatalogColumnPrefs(columns: CatalogDataColumnId[]): void {
  if (typeof window === "undefined") return;
  const payload: CatalogColumnPrefs = { columns };
  window.localStorage.setItem(CATALOG_COLUMN_PREFS_KEY, JSON.stringify(payload));
}
