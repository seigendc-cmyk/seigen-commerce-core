"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CATALOG_COLUMN_LABELS,
  CATALOG_DATA_COLUMN_IDS,
  CATALOG_MASTER_COLUMN_ORDER,
  defaultVisibleColumnOrder,
  type CatalogDataColumnId,
} from "../types/catalog-columns";
import { readCatalogColumnPrefs, writeCatalogColumnPrefs } from "../services/catalog-column-prefs";
import { parseSearchTokens, productMatchesSearchTokens } from "../services/product-catalog-search";
import type { ProductReadModel } from "../types/product-read-model";
import { ProductHistoryModal } from "./product-history-modal";

function money(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function formatCell(col: CatalogDataColumnId, row: ProductReadModel): string {
  switch (col) {
    case "primaryImage":
      return "";
    case "sku":
      return row.sku;
    case "name":
      return row.name;
    case "sectorLabel":
      return row.sectorLabel;
    case "sectorId":
      return row.sectorId;
    case "unit":
      return row.unit;
    case "barcode":
      return row.barcode ?? "";
    case "brand":
      return row.brand ?? "";
    case "costPrice":
      return money(row.costPrice);
    case "sellingPrice":
      return money(row.sellingPrice);
    case "onHandQty":
      return String(row.onHandQty);
    case "active":
      return row.active ? "Yes" : "No";
    case "ideliverExternal":
      return row.flagExternalIdeliver ? "Yes" : "No";
    case "branchId":
      return row.branchId;
    case "id":
      return row.id;
    default:
      return "";
  }
}

function columnAlign(col: CatalogDataColumnId): "left" | "right" {
  if (col === "costPrice" || col === "sellingPrice" || col === "onHandQty") return "right";
  return "left";
}

function isThumbColumn(col: CatalogDataColumnId): boolean {
  return col === "primaryImage";
}

export function InventoryProductCatalogTab({ rows }: { rows: ProductReadModel[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<CatalogDataColumnId[]>(() => readCatalogColumnPrefs());
  const [historyProduct, setHistoryProduct] = useState<ProductReadModel | null>(null);

  useEffect(() => {
    writeCatalogColumnPrefs(visibleColumns);
  }, [visibleColumns]);

  const tokens = useMemo(() => parseSearchTokens(search), [search]);

  const filtered = useMemo(() => {
    if (tokens.length === 0) return rows;
    return rows.filter((r) => productMatchesSearchTokens(r, tokens));
  }, [rows, tokens]);

  const toggleColumn = (id: CatalogDataColumnId) => {
    setVisibleColumns((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev;
        return prev.filter((c) => c !== id);
      }
      const masterIdx = CATALOG_MASTER_COLUMN_ORDER.indexOf(id);
      let insertAt = prev.length;
      for (let i = 0; i < prev.length; i++) {
        if (CATALOG_MASTER_COLUMN_ORDER.indexOf(prev[i]) > masterIdx) {
          insertAt = i;
          break;
        }
      }
      const next = [...prev];
      next.splice(insertAt, 0, id);
      return next;
    });
  };

  const moveColumn = (index: number, dir: -1 | 1) => {
    setVisibleColumns((prev) => {
      const j = index + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  };

  const resetColumns = () => setVisibleColumns(defaultVisibleColumnOrder());

  return (
    <section className="vendor-panel-soft rounded-2xl p-6">
      {historyProduct ? (
        <ProductHistoryModal product={historyProduct} onClose={() => setHistoryProduct(null)} />
      ) : null}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Item List</h2>
          <p className="mt-1 text-sm text-neutral-300">
            All products as a table. <span className="text-neutral-200">Click a row</span> to open full product history
            (sales, receiving, POs, stocktake). Search matches every word in any order across SKU, name, sector, prices,
            stock, external iDeliver flags, and other fields.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="catalog-search">
            Search item list
          </label>
          <input
            id="catalog-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="e.g. widget12.99 active"
            className="vendor-field w-full min-w-[200px] rounded-lg px-3 py-2 text-sm sm:w-72"
          />
          <button
            type="button"
            onClick={() => setColumnsOpen((o) => !o)}
            className="vendor-btn-secondary-dark font-semibold"
          >
            {columnsOpen ? "Hide columns" : "Columns"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard/inventory/add-product")}
            className="rounded-lg bg-brand-orange px-3 py-2 text-sm font-semibold text-white hover:bg-brand-orange-hover"
          >
            Add
          </button>
        </div>
      </div>

      {columnsOpen ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-white">Visible columns (order)</p>
            <button
              type="button"
              onClick={resetColumns}
              className="text-xs font-semibold text-brand-orange hover:underline"
            >
              Reset to default
            </button>
          </div>
          <ul className="mt-3 flex flex-wrap gap-2">
            {visibleColumns.map((col, idx) => (
              <li
                key={col}
                className="flex items-center gap-1 rounded-lg border border-white/22 bg-white/[0.08] px-2 py-1 text-xs text-neutral-100"
              >
                <span className="font-medium text-white">{CATALOG_COLUMN_LABELS[col]}</span>
                <button
                  type="button"
                  className="rounded px-1 text-neutral-400 hover:bg-white/10 hover:text-white"
                  onClick={() => moveColumn(idx, -1)}
                  disabled={idx === 0}
                  aria-label={`Move ${CATALOG_COLUMN_LABELS[col]} left`}
                >
                  ←
                </button>
                <button
                  type="button"
                  className="rounded px-1 text-neutral-400 hover:bg-white/10 hover:text-white"
                  onClick={() => moveColumn(idx, 1)}
                  disabled={idx === visibleColumns.length - 1}
                  aria-label={`Move ${CATALOG_COLUMN_LABELS[col]} right`}
                >
                  →
                </button>
              </li>
            ))}
          </ul>
          <fieldset className="mt-4 border-0 p-0">
            <legend className="text-xs font-medium text-neutral-400">Show / hide fields</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {CATALOG_DATA_COLUMN_IDS.map((id) => (
                <label key={id} className="flex cursor-pointer items-center gap-2 text-sm text-neutral-100">
                  <input
                    type="checkbox"
                    className="rounded border-white/30 bg-transparent"
                    checked={visibleColumns.includes(id)}
                    disabled={visibleColumns.length === 1 && visibleColumns.includes(id)}
                    onChange={() => toggleColumn(id)}
                  />
                  {CATALOG_COLUMN_LABELS[id]}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="vendor-empty mt-4 rounded-xl px-4 py-6 text-center text-sm leading-relaxed">
          No products yet. Use <span className="font-semibold text-brand-orange">Add</span> to create your first item.
        </div>
      ) : filtered.length === 0 ? (
        <div className="vendor-empty mt-4 rounded-xl px-4 py-5 text-center text-sm">
          No matches. Try fewer or different words — each word must appear somewhere in the product (any field, any
          order).
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b-2 border-brand-orange bg-gradient-to-b from-brand-orange/30 via-brand-orange/15 to-black/40">
              <tr>
                {visibleColumns.map((col) => (
                  <th
                    key={col}
                    scope="col"
                    className={`px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-white ${columnAlign(col) === "right" ? "text-right" : "text-left"}`}
                  >
                    {CATALOG_COLUMN_LABELS[col]}
                  </th>
                ))}
                <th
                  scope="col"
                  className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-white"
                >
                  {CATALOG_COLUMN_LABELS.actions}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open product history for ${r.name}`}
                  onClick={() => setHistoryProduct(r)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setHistoryProduct(r);
                    }
                  }}
                  className="cursor-pointer bg-white/[0.03] hover:bg-white/[0.08]"
                >
                  {visibleColumns.map((col) => (
                    <td
                      key={col}
                      className={`px-4 py-3 text-neutral-200 ${col === "sku" || col === "id" ? "font-mono text-xs" : ""} ${columnAlign(col) === "right" ? "text-right tabular-nums text-white" : ""}`}
                    >
                      {col === "primaryImage" ? (
                        <div className="flex items-center">
                          <div className="h-9 w-9 overflow-hidden rounded-md border border-white/10 bg-black/30">
                            {r.primaryImage?.dataUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={r.primaryImage.dataUrl} alt="" className="h-full w-full object-cover" />
                            ) : null}
                          </div>
                        </div>
                      ) : col === "name" ? (
                        <span className="inline-flex flex-wrap items-center gap-2">
                          <span>{r.name}</span>
                          {r.flagExternalIdeliver ? (
                            <span className="inline-flex shrink-0 rounded border border-amber-500/45 bg-amber-500/12 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-100">
                              External iDeliver
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        (formatCell(col, r) || "—")
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/dashboard/inventory/edit-product/${r.id}`}
                      className="font-semibold text-brand-orange hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
