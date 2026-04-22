import type { Id, PurchaseOrder } from "@/modules/inventory/types/models";
import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";
import { computePurchaseOrderTotal } from "@/modules/inventory/services/purchasing-service";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function money(n: number): string {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export type PurchaseOrderDocumentContext = {
  purchaseOrder: PurchaseOrder;
  supplierName: string;
  supplierContactLine: string | null;
  branchName: string;
  branchAddressLine: string | null;
  lines: Array<{
    itemId: Id;
    productId: Id;
    sku: string;
    name: string;
    orderedQty: number;
    expectedUnitCost: number;
    lineTotal: number;
  }>;
  total: number;
};

export function buildPurchaseOrderDocumentContext(po: PurchaseOrder): PurchaseOrderDocumentContext {
  const supplier = InventoryRepo.getSupplier(po.supplierId);
  const branch = InventoryRepo.getBranch(po.branchId);
  const lines = po.items.map((it) => {
    const p = InventoryRepo.getProduct(it.productId);
    const lineTotal = Math.round(it.orderedQty * it.expectedUnitCost * 100) / 100;
    return {
      itemId: it.id,
      productId: it.productId,
      sku: p?.sku ?? it.productId,
      name: p?.name ?? "Product",
      orderedQty: it.orderedQty,
      expectedUnitCost: it.expectedUnitCost,
      lineTotal,
    };
  });
  const total = computePurchaseOrderTotal(po);
  const supplierContactLine =
    supplier && (supplier.phone?.trim() || supplier.email?.trim())
      ? [supplier.phone?.trim(), supplier.email?.trim()].filter(Boolean).join(" · ")
      : null;
  const branchAddressLine = branch?.address?.trim() ? branch.address.trim() : null;
  return {
    purchaseOrder: po,
    supplierName: supplier?.name?.trim() || "Supplier",
    supplierContactLine,
    branchName: branch?.name?.trim() || po.branchId,
    branchAddressLine,
    lines,
    total,
  };
}

export function poRef(po: PurchaseOrder): string {
  const r = po.reference?.trim();
  if (r) return r;
  const tail = po.id.replace(/^po_/, "").slice(-10).toUpperCase();
  return `PO-${tail}`;
}

export function buildPurchaseOrderHtml(ctx: PurchaseOrderDocumentContext, opts?: { autoPrint?: boolean }): string {
  const ref = poRef(ctx.purchaseOrder);
  const when = new Date(ctx.purchaseOrder.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  const rows = ctx.lines
    .map(
      (l) => `<tr>
  <td>${esc(l.name)}</td>
  <td class="mono">${esc(l.sku)}</td>
  <td class="num">${l.orderedQty}</td>
  <td class="num">${money(l.expectedUnitCost)}</td>
  <td class="num">${money(l.lineTotal)}</td>
</tr>`,
    )
    .join("");
  const branchBlock = ctx.branchAddressLine
    ? `${esc(ctx.branchName)}<br/><span class="sub">${esc(ctx.branchAddressLine)}</span>`
    : esc(ctx.branchName);
  const supplierBlock = ctx.supplierContactLine
    ? `${esc(ctx.supplierName)}<br/><span class="sub">${esc(ctx.supplierContactLine)}</span>`
    : esc(ctx.supplierName);
  const terms = ctx.purchaseOrder.paymentTerms === "credit" ? "Credit (supplier AP)" : "Cash (COGS reserves)";

  return `<!doctype html><html><head><meta charset="utf-8"/><title>${esc(ref)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; color: #111; }
  .sheet { width: 210mm; max-width: 100%; margin: 0 auto; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  .meta { color: #444; font-size: 13px; margin-bottom: 14px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 18px; margin-bottom: 12px; font-size: 13px; }
  .label { color: #666; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
  .sub { font-size: 12px; color: #555; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #334155; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .mono { font-family: ui-monospace, monospace; font-size: 12px; }
  tfoot td { font-weight: 700; background: #fafafa; }
  .notes { margin-top: 10px; font-size: 12.5px; color: #0f172a; white-space: pre-wrap; }
  .foot { margin-top: 18px; font-size: 11px; color: #475569; }
</style></head><body>
  <div class="sheet">
    <h1>Purchase Order</h1>
    <div class="meta"><strong>${esc(ref)}</strong> · ${esc(when)} · Status: ${esc(ctx.purchaseOrder.status)} · Terms: ${esc(terms)}</div>
    <div class="grid">
      <div>
        <div class="label">Supplier</div>
        <div>${supplierBlock}</div>
      </div>
      <div>
        <div class="label">Deliver to</div>
        <div>${branchBlock}</div>
      </div>
    </div>
    <table>
      <thead><tr><th>Product</th><th>SKU</th><th class="num">Qty</th><th class="num">Unit cost</th><th class="num">Line total</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="5" class="sub">No line items.</td></tr>`}</tbody>
      <tfoot><tr><td colspan="4" class="num">Estimated total</td><td class="num">${money(ctx.total)}</td></tr></tfoot>
    </table>
    ${ctx.purchaseOrder.notes?.trim() ? `<div class="notes"><div class="label">Notes</div>${esc(ctx.purchaseOrder.notes.trim())}</div>` : ""}
    <div class="foot">This purchase order is an instructional memo. Stock increases only when goods are received.</div>
  </div>
  ${
    opts?.autoPrint
      ? `<script>window.addEventListener("load", function() { setTimeout(function(){ window.print(); }, 200); });</script>`
      : ""
  }
</body></html>`;
}

export function openPurchaseOrderPrint(po: PurchaseOrder): void {
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) return;
  const ctx = buildPurchaseOrderDocumentContext(po);
  w.document.write(buildPurchaseOrderHtml(ctx, { autoPrint: true }));
  w.document.close();
}

export function downloadPurchaseOrderHtml(filename: string, po: PurchaseOrder): void {
  const ctx = buildPurchaseOrderDocumentContext(po);
  const html = buildPurchaseOrderHtml(ctx);
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

