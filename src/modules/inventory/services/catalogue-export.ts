"use client";

import type { Id } from "../types/models";
import { InventoryRepo } from "./inventory-repo";
import { listProductReadModels } from "./product-read-model";
import { baseCurrencyCode } from "@/modules/financial/services/currency-settings";
import { readTaxOnSalesSettings } from "@/modules/financial/services/tax-settings";
import { readDemoSession } from "@/lib/demo-session";
import { catalogVerifiedItemCapForPlan } from "@/lib/plans";

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function money(n: number): string {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function isVerifiedForPlanCatalogue(p: { active: boolean; forSale: boolean; images: unknown[] }): boolean {
  return p.active && p.forSale !== false && Array.isArray(p.images) && p.images.length > 0;
}

export type CatalogueExportOptions = {
  branchId: Id;
  includeInactive?: boolean;
  includeNotForSale?: boolean;
  includeZeroStock?: boolean;
};

export function buildCatalogueHtml(opts: CatalogueExportOptions): string {
  const branch = InventoryRepo.getBranch(opts.branchId);
  const branchName = branch?.name ?? "Branch";
  const generatedAt = new Date().toLocaleString();
  const currency = baseCurrencyCode();
  const ts = readTaxOnSalesSettings();
  const taxInfo = ts.enabled && ts.ratePercent > 0 ? `${ts.taxLabel} ${ts.ratePercent}% · ${ts.pricesTaxInclusive ? "incl." : "excl."}` : `${ts.taxLabel} · off`;

  const baseRows = listProductReadModels(opts.branchId).filter((p) => {
    if (!opts.includeInactive && !p.active) return false;
    if (!opts.includeNotForSale && p.forSale === false) return false;
    if (!opts.includeZeroStock && p.onHandQty <= 0) return false;
    return true;
  });
  const session = readDemoSession();
  const cap = catalogVerifiedItemCapForPlan(session?.planId ?? null);
  const verified = cap != null ? baseRows.filter((p) => isVerifiedForPlanCatalogue(p as any)) : baseRows;
  const rows = cap != null ? verified.slice(0, cap) : verified;

  const title = `${branchName} Catalogue`;

  const bodyRows = rows
    .map((p) => {
      const img = p.primaryImage?.url || p.primaryImage?.dataUrl ? "Yes" : "—";
      return `
        <tr>
          <td class="mono">${escapeHtml(p.sku || "—")}</td>
          <td>${escapeHtml(p.name)}</td>
          <td class="num">${money(p.sellingPrice)}</td>
          <td class="num">${money(p.onHandQty)}</td>
          <td class="center">${img}</td>
        </tr>
      `;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light; }
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 24px; color: #0f172a; }
      header { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px; }
      h1 { font-size: 18px; margin: 0; }
      .meta { font-size: 12px; color: #475569; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border-bottom: 1px solid #e2e8f0; padding: 10px 8px; font-size: 12px; vertical-align: top; }
      th { text-align: left; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: #475569; }
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
      .num { text-align: right; }
      .center { text-align: center; }
      .footer { margin-top: 18px; font-size: 11px; color: #64748b; }
      @media print { body { margin: 12mm; } header { border-bottom-color: #cbd5e1; } }
    </style>
  </head>
  <body>
    <header>
      <div>
        <h1>${escapeHtml(title)}</h1>
        <div class="meta">Generated ${escapeHtml(generatedAt)} · Items ${rows.length} · Currency ${escapeHtml(currency)} · Tax ${escapeHtml(taxInfo)}${
          cap != null ? ` · Plan cap ${rows.length}/${cap} verified items` : ""
        }</div>
      </div>
      <div class="meta">seiGEN Commerce</div>
    </header>

    <table>
      <thead>
        <tr>
          <th style="width: 18%">SKU</th>
          <th>Product</th>
          <th style="width: 14%" class="num">Price (${escapeHtml(currency)})</th>
          <th style="width: 14%" class="num">On hand</th>
          <th style="width: 10%" class="center">Image</th>
        </tr>
      </thead>
      <tbody>
        ${bodyRows || `<tr><td colspan="5" class="meta">No matching products for the selected filters.</td></tr>`}
      </tbody>
    </table>

    <div class="footer">
      Note: This catalogue is a derived snapshot from local inventory truth. Prices and stock can change after export.
    </div>
  </body>
</html>`;
}

export function openCatalogueInNewWindow(html: string): void {
  if (typeof window === "undefined") return;
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
}

export function downloadCatalogueHtml(filename: string, html: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

