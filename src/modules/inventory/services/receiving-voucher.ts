import type { GoodsReceipt, Id, PurchaseOrder } from "@/modules/inventory/types/models";
import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";

export type ReceivingVoucherContext = {
  receipt: GoodsReceipt;
  purchaseOrder: PurchaseOrder;
  supplierName: string;
  branchName: string;
  branchAddress?: string;
  productLines: Array<{
    productId: Id;
    name: string;
    sku: string;
    receivedQty: number;
    unitCost: number;
    lineTotal: number;
  }>;
};

/** Build print/share payload from a saved goods receipt. */
export function buildReceivingVoucherContext(receipt: GoodsReceipt, purchaseOrder: PurchaseOrder): ReceivingVoucherContext {
  const supplier = InventoryRepo.getSupplier(purchaseOrder.supplierId);
  const branch = InventoryRepo.getBranch(receipt.branchId);
  const productLines = receipt.items.map((it) => {
    const p = InventoryRepo.getProduct(it.productId);
    const lineTotal = Math.round(it.receivedQty * it.unitCost * 100) / 100;
    return {
      productId: it.productId,
      name: p?.name ?? "Product",
      sku: p?.sku ?? it.productId,
      receivedQty: it.receivedQty,
      unitCost: it.unitCost,
      lineTotal,
    };
  });
  return {
    receipt,
    purchaseOrder,
    supplierName: supplier?.name?.trim() || "Supplier",
    branchName: branch?.name?.trim() || receipt.branchId,
    branchAddress: branch?.address?.trim() || undefined,
    productLines,
  };
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function money(n: number): string {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function voucherRefFromReceipt(receipt: GoodsReceipt): string {
  const tail = receipt.id.replace(/^grn_/, "").slice(-10).toUpperCase();
  return `GRN-${tail}`;
}

export function buildReceivingVoucherPlainText(ctx: ReceivingVoucherContext): string {
  const ref = voucherRefFromReceipt(ctx.receipt);
  const when = new Date(ctx.receipt.receivedAt).toLocaleString();
  const lines = ctx.productLines
    .filter((l) => l.receivedQty > 0)
    .map(
      (l) =>
        `• ${l.name} (${l.sku})  Qty ${l.receivedQty} @ ${money(l.unitCost)} = ${money(l.lineTotal)}`,
    )
    .join("\n");
  const total = ctx.productLines.reduce((s, l) => s + l.lineTotal, 0);
  return [
    `Receiving voucher ${ref}`,
    `Received: ${when}`,
    `Warehouse / shop: ${ctx.branchName}`,
    `PO: ${ctx.purchaseOrder.reference ?? ctx.purchaseOrder.id}`,
    `Supplier: ${ctx.supplierName}`,
    ctx.receipt.notes ? `Notes: ${ctx.receipt.notes}` : "",
    "",
    lines,
    "",
    `Total (this receipt): ${money(total)}`,
    "",
    `SEIGEN Commerce — goods receipt confirmation`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildReceivingVoucherHtml(ctx: ReceivingVoucherContext, opts?: { autoPrint?: boolean }): string {
  const ref = voucherRefFromReceipt(ctx.receipt);
  const when = new Date(ctx.receipt.receivedAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const rows = ctx.productLines
    .filter((l) => l.receivedQty > 0)
    .map(
      (l) => `<tr>
      <td>${esc(l.name)}</td>
      <td class="mono">${esc(l.sku)}</td>
      <td class="num">${l.receivedQty}</td>
      <td class="num">${money(l.unitCost)}</td>
      <td class="num">${money(l.lineTotal)}</td>
    </tr>`,
    )
    .join("");
  const total = ctx.productLines.reduce((s, l) => s + l.lineTotal, 0);
  const branchBlock = ctx.branchAddress
    ? `${esc(ctx.branchName)}<br/><span class="sub">${esc(ctx.branchAddress)}</span>`
    : esc(ctx.branchName);

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(ref)}</title>
<style>
  body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; padding: 28px; color: #111; max-width: 800px; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .meta { color: #444; font-size: 14px; margin-bottom: 20px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; margin-bottom: 20px; font-size: 14px; }
  .label { color: #666; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
  .sub { font-size: 12px; color: #555; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { border: 1px solid #ccc; padding: 8px 10px; text-align: left; }
  th { background: #f0f0f0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .mono { font-family: ui-monospace, monospace; font-size: 12px; }
  tfoot td { font-weight: 600; background: #fafafa; }
  .foot { margin-top: 28px; font-size: 12px; color: #555; }
  @media print { body { padding: 12px; } }
</style></head><body>
  <h1>Receiving voucher</h1>
  <p class="meta"><strong>${esc(ref)}</strong> · ${esc(when)}</p>
  <div class="grid">
    <div>
      <div class="label">Warehouse / shop</div>
      <div>${branchBlock}</div>
    </div>
    <div>
      <div class="label">Purchase order</div>
      <div>${esc(ctx.purchaseOrder.reference ?? ctx.purchaseOrder.id)}</div>
      <div class="label" style="margin-top:10px">Supplier</div>
      <div>${esc(ctx.supplierName)}</div>
    </div>
  </div>
  ${ctx.receipt.notes ? `<p><span class="label">Notes</span><br/>${esc(ctx.receipt.notes)}</p>` : ""}
  <table>
    <thead><tr><th>Product</th><th>SKU</th><th class="num">Qty</th><th class="num">Unit cost</th><th class="num">Line total</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td colspan="4" class="num">Total (this receipt)</td><td class="num">${money(total)}</td></tr></tfoot>
  </table>
  <p class="foot">Stock was updated for the selected warehouse. Retain this voucher for your records.</p>
  ${
    opts?.autoPrint
      ? `<script>window.addEventListener("load", function() { setTimeout(function() { window.print(); }, 200); });</script>`
      : ""
  }
</body></html>`;
}

/** Opens a tab with the voucher; print dialog runs automatically (user can Save as PDF). */
export function openReceivingVoucherPrint(ctx: ReceivingVoucherContext): void {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(buildReceivingVoucherHtml(ctx, { autoPrint: true }));
  w.document.close();
}

export function whatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function telegramShareUrl(text: string): string {
  return `https://t.me/share/url?text=${encodeURIComponent(text)}`;
}
