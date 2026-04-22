"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useWorkspace } from "@/components/dashboard/workspace-context";
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
import { buildPublishMarketListingPayloadFromOperationalTruth } from "@/modules/market-space/services/operational-listing-payload-builder";
import { publishOperationalListingDraftAction } from "@/modules/market-space/actions/operational-publisher-actions";
import { refreshMarketListingProjectionAction } from "@/modules/market-space/actions/publish-listing-actions";
import { readVendorCore } from "@/modules/dashboard/settings/vendor-core-storage";
import type { ShopBranch } from "@/modules/dashboard/settings/branches/branch-types";
import { readLocalListingIdForProduct, writeLocalListingLink } from "@/modules/market-space/services/local-listing-link-store";

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
  const workspace = useWorkspace();
  const [search, setSearch] = useState("");
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<CatalogDataColumnId[]>(() => readCatalogColumnPrefs());
  const [historyProduct, setHistoryProduct] = useState<ProductReadModel | null>(null);
  const [publishMsg, setPublishMsg] = useState<string | null>(null);
  const [publishingKey, setPublishingKey] = useState<string | null>(null);

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

  function vendorGeoForBranch(branchId: string): { city?: string | null; suburb?: string | null; province?: string | null; country?: string | null } {
    const branches = readVendorCore<ShopBranch[]>("branches", []);
    const b = branches.find((x) => x.id === branchId);
    if (!b) return {};
    return {
      city: b.city?.trim() ? b.city.trim() : null,
      suburb: b.suburb?.trim() ? b.suburb.trim() : null,
      province: b.region?.trim() ? b.region.trim() : null,
      country: b.country?.trim() ? b.country.trim() : null,
    };
  }

  async function syncDraftListingFromOperationalTruth(row: ProductReadModel) {
    const tenantId = workspace?.tenant?.id;
    if (!tenantId) {
      setPublishMsg("Workspace tenant not loaded. Sign in and ensure provisioning is complete.");
      return;
    }

    const key = `${row.branchId}:${row.id}`;
    setPublishingKey(key);
    setPublishMsg(null);
    try {
      const geo = vendorGeoForBranch(row.branchId);
      const built = buildPublishMarketListingPayloadFromOperationalTruth({
        vendor_id: tenantId,
        storefront_id: tenantId,
        branch_id: row.branchId,
        product_id: row.id,
        publish_status: "draft",
        ...geo,
        // Drafts should be non-public until vendor completes geo/media.
        visible_in_market_space: false,
        visible_in_itred: false,
      });
      if (!built.ok) {
        setPublishMsg(built.error);
        return;
      }

      const res = await publishOperationalListingDraftAction({ payload: built.payload });
      if (!res.ok) {
        setPublishMsg(res.validationErrors?.length ? `${res.error}: ${res.validationErrors.join(", ")}` : res.error);
        return;
      }

      writeLocalListingLink({ branchId: row.branchId, productId: row.id, listingId: res.listingId });
      setPublishMsg(`Draft listing synced (listingId ${res.listingId}).`);
    } finally {
      setPublishingKey(null);
    }
  }

  async function refreshProjectionFromOperationalTruth(row: ProductReadModel) {
    const listingId = readLocalListingIdForProduct({ branchId: row.branchId, productId: row.id });
    if (!listingId) {
      setPublishMsg("No listingId recorded for this product+branch yet. Sync draft first.");
      return;
    }
    const tenantId = workspace?.tenant?.id;
    if (!tenantId) {
      setPublishMsg("Workspace tenant not loaded.");
      return;
    }

    const key = `refresh:${row.branchId}:${row.id}`;
    setPublishingKey(key);
    setPublishMsg(null);
    try {
      const geo = vendorGeoForBranch(row.branchId);
      const built = buildPublishMarketListingPayloadFromOperationalTruth({
        vendor_id: tenantId,
        storefront_id: tenantId,
        branch_id: row.branchId,
        product_id: row.id,
        publish_status: "draft",
        ...geo,
        visible_in_market_space: false,
        visible_in_itred: false,
      });
      if (!built.ok) {
        setPublishMsg(built.error);
        return;
      }

      // Builder-owned fields win. Do NOT patch geo/media/visibility unless explicitly provided.
      const patch = {
        sku: built.payload.sku ?? null,
        listing_slug: built.payload.listing_slug,
        title: built.payload.title,
        short_description: built.payload.short_description ?? null,
        brand: built.payload.brand ?? null,
        category_id: built.payload.category_id ?? null,
        category_name: built.payload.category_name ?? null,
        searchable_text: built.payload.searchable_text ?? null,
        public_price: built.payload.public_price,
        currency_code: built.payload.currency_code,
        stock_badge: built.payload.stock_badge ?? null,
        stock_signal: built.payload.stock_signal ?? null,
        pickup_supported: built.payload.pickup_supported ?? false,
        delivery_supported: built.payload.delivery_supported ?? false,
      };

      const res = await refreshMarketListingProjectionAction(listingId, patch);
      if (!res.ok) {
        setPublishMsg(res.error);
        return;
      }
      setPublishMsg("Projection refreshed from operational truth.");
    } finally {
      setPublishingKey(null);
    }
  }

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
            className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700"
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
              className="text-xs font-semibold text-teal-300 hover:text-teal-200 hover:underline"
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

      {publishMsg ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-neutral-200">
          {publishMsg}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="vendor-empty mt-4 rounded-xl px-4 py-6 text-center text-sm leading-relaxed">
          No products yet. Use <span className="font-semibold text-teal-300">Add</span> to create your first item.
        </div>
      ) : filtered.length === 0 ? (
        <div className="vendor-empty mt-4 rounded-xl px-4 py-5 text-center text-sm">
          No matches. Try fewer or different words — each word must appear somewhere in the product (any field, any
          order).
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b-2 border-teal-500/60 bg-gradient-to-b from-teal-600/35 via-teal-900/40 to-slate-950/90">
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
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void syncDraftListingFromOperationalTruth(r);
                        }}
                        disabled={publishingKey === `${r.branchId}:${r.id}`}
                        className="text-xs font-semibold text-emerald-300 hover:text-emerald-200 hover:underline disabled:opacity-60"
                      >
                        Sync draft
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void refreshProjectionFromOperationalTruth(r);
                        }}
                        disabled={publishingKey === `refresh:${r.branchId}:${r.id}`}
                        className="text-xs font-semibold text-sky-300 hover:text-sky-200 hover:underline disabled:opacity-60"
                      >
                        Refresh projection
                      </button>
                      <Link
                        href={`/dashboard/inventory/edit-product/${r.id}`}
                        className="text-xs font-semibold text-teal-300 hover:text-teal-200 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Edit
                      </Link>
                    </div>
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
