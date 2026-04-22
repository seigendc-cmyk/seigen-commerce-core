import { readTaxOnSalesSettings } from "@/modules/financial/services/tax-settings";
import { baseCurrencyCode } from "@/modules/financial/services/currency-settings";
import type { PaymentMethod, Sale } from "../types/pos";

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  mobile_money: "Mobile money",
  bank: "Bank",
  other: "Other",
};

/** Fixed width for thermal / legacy 80-column receipts. */
export const RECEIPT_COLS = 80;

export function paymentLabel(method: PaymentMethod): string {
  return PAYMENT_LABELS[method] ?? method;
}

export function formatReceiptMoney(n: number): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatReceiptWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export type ReceiptFormatMeta = {
  storeName?: string;
  branchName?: string;
  registerLabel?: string;
  tradingName?: string;
  legalName?: string;
  taxId?: string;
  addressLines?: string;
  phone?: string;
  logoDataUrl?: string | null;
  footerMessage?: string;
  fiscalSignature?: string;
  fiscalQrPayload?: string;
  /** Optional pre-generated QR image for HTML/PDF. */
  fiscalQrDataUrl?: string | null;
};

function fill(s: string, width: number): string {
  if (s.length >= width) return s.slice(0, width);
  return s + " ".repeat(width - s.length);
}

function lineLR(left: string, right: string, width: number): string {
  const r = right.trim();
  const maxLeft = width - r.length - 1;
  const L = left.trim().slice(0, Math.max(0, maxLeft));
  const gap = width - L.length - r.length;
  if (gap < 1) return `${L.slice(0, width - r.length - 1)} ${r}`.slice(0, width);
  return `${L}${" ".repeat(gap)}${r}`;
}

function centerLine(text: string, width: number): string {
  const t = text.trim();
  if (t.length >= width) return t.slice(0, width);
  const pad = width - t.length;
  const left = Math.floor(pad / 2);
  return `${" ".repeat(left)}${t}${" ".repeat(pad - left)}`;
}

function repeatChar(ch: string, n: number): string {
  return Array(n + 1).join(ch);
}

/**
 * 80-column plain text suitable for .txt download, WhatsApp, Telegram, and PDF body.
 */
export function formatReceiptPlainText(sale: Sale, meta: ReceiptFormatMeta = {}): string {
  const W = RECEIPT_COLS;
  const store = meta.tradingName || meta.storeName || "seiGEN Commerce";
  const legal = meta.legalName?.trim();
  const branch = meta.branchName ?? sale.branchId;
  const register = meta.registerLabel ? ` · ${meta.registerLabel}` : "";
  const head = sale.status === "voided" ? "VOID RECEIPT" : "TAX INVOICE / RECEIPT";
  const currency = baseCurrencyCode();
  const ts = readTaxOnSalesSettings();
  const taxRate = sale.taxRatePercentSnapshot ?? ts.ratePercent;
  const taxOn = ts.enabled && taxRate > 0;
  const incl = (sale.pricesTaxInclusiveSnapshot ?? ts.pricesTaxInclusive) ? "incl." : "excl.";
  const taxInfo = taxOn ? `${ts.taxLabel} ${taxRate}% · ${incl}` : `${ts.taxLabel} · off`;

  const lines: string[] = [];
  lines.push(centerLine(head, W));
  lines.push(centerLine(store, W));
  if (legal) lines.push(centerLine(legal, W));
  if (meta.taxId?.trim()) lines.push(centerLine(`Tax / VAT ID: ${meta.taxId.trim()}`, W));
  if (meta.addressLines?.trim()) {
    for (const chunk of wrapText(meta.addressLines.trim(), W)) lines.push(chunk);
  }
  if (meta.phone?.trim()) lines.push(centerLine(meta.phone.trim(), W));
  lines.push(repeatChar("-", W));
  lines.push(centerLine(sale.receiptNumber, W));
  lines.push(fill(formatReceiptWhen(sale.createdAt) + register, W));
  lines.push(lineLR(`Branch: ${branch}`, `Status: ${sale.status}`, W));
  lines.push(lineLR("Currency", currency, W));
  lines.push(lineLR("Tax", taxInfo, W));
  lines.push(repeatChar("-", W));

  for (const l of sale.lines) {
    const desc = `${l.qty}× ${l.name} (${l.sku})`;
    for (const chunk of wrapText(desc, W - 12)) {
      lines.push(chunk);
    }
    lines.push(lineLR(`  ${l.unit} @ ${formatReceiptMoney(l.unitPrice)}`, formatReceiptMoney(l.lineTotal), W));
  }

  lines.push(repeatChar("-", W));
  lines.push(lineLR("Goods subtotal", formatReceiptMoney(sale.subtotal), W));
  if (sale.deliveryFee > 0) {
    const dl = sale.ideliverProviderName
      ? `Delivery (iDeliver · ${sale.ideliverProviderName})`
      : "Delivery (iDeliver)";
    lines.push(lineLR(dl, formatReceiptMoney(sale.deliveryFee), W));
    lines.push(
      fill(
        `  Fare source: ${sale.ideliverFareSource === "override" ? "override" : "radius schedule"}`,
        W,
      ),
    );
  }
  if (sale.salesTaxAmount && sale.salesTaxAmount > 0) {
    const tl = readTaxOnSalesSettings().taxLabel;
    const pct = sale.taxRatePercentSnapshot != null ? ` (${sale.taxRatePercentSnapshot}%)` : "";
    const incl = sale.pricesTaxInclusiveSnapshot ? " · incl. in prices" : "";
    lines.push(lineLR(`${tl}${pct}${incl}`, formatReceiptMoney(sale.salesTaxAmount), W));
  }
  lines.push(lineLR("AMOUNT DUE", formatReceiptMoney(sale.amountDue), W));
  lines.push(repeatChar("-", W));

  for (const p of sale.payments) {
    lines.push(lineLR(paymentLabel(p.method), formatReceiptMoney(p.amount), W));
  }
  lines.push(lineLR("Total paid", formatReceiptMoney(sale.totalPaid), W));
  lines.push(lineLR("Change", formatReceiptMoney(sale.changeDue), W));
  lines.push(repeatChar("-", W));

  if (meta.footerMessage?.trim()) {
    for (const chunk of wrapText(meta.footerMessage.trim(), W)) lines.push(chunk);
    lines.push(repeatChar("-", W));
  }

  if (meta.fiscalSignature?.trim()) {
    lines.push(centerLine("FISCAL / VERIFICATION", W));
    for (const chunk of wrapText(meta.fiscalSignature.trim(), W)) lines.push(chunk);
  }
  if (meta.fiscalQrPayload?.trim()) {
    lines.push(centerLine("OQR / PAYLOAD", W));
    for (const chunk of wrapText(meta.fiscalQrPayload.trim(), W)) lines.push(chunk);
  }

  return lines.join("\n");
}

function wrapText(text: string, width: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [fill("", width)];
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur.length === 0) {
      cur = w;
      continue;
    }
    if (cur.length + 1 + w.length <= width) cur += ` ${w}`;
    else {
      out.push(fill(cur, width));
      cur = w.length > width ? w.slice(0, width) : w;
    }
  }
  if (cur.length) out.push(fill(cur, width));
  return out.length ? out : [fill("", width)];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type ReceiptPrintHtmlOptions = {
  /** Large diagonal overlay for reprints from Sales History. */
  reprintWatermark?: boolean;
};

/**
 * Print-oriented HTML: 80ch column, professional blocks, logo, footer, fiscal + QR.
 */
export function buildReceiptPrintHtmlDocument(
  sale: Sale,
  meta: ReceiptFormatMeta = {},
  opts: ReceiptPrintHtmlOptions = {},
): string {
  const store = meta.tradingName || meta.storeName || "seiGEN Commerce";
  const branch = meta.branchName ?? sale.branchId;
  const register = meta.registerLabel ? ` · ${meta.registerLabel}` : "";
  const currency = baseCurrencyCode();
  const ts = readTaxOnSalesSettings();
  const taxRate = sale.taxRatePercentSnapshot ?? ts.ratePercent;
  const taxOn = ts.enabled && taxRate > 0;
  const incl = (sale.pricesTaxInclusiveSnapshot ?? ts.pricesTaxInclusive) ? "incl." : "excl.";
  const taxInfo = taxOn ? `${ts.taxLabel} ${taxRate}% · ${incl}` : `${ts.taxLabel} · off`;
  const voidBanner = sale.status === "voided" ? `<div class="void">VOID</div>` : "";
  const logo =
    meta.logoDataUrl && meta.logoDataUrl.startsWith("data:")
      ? `<div class="logo"><img src="${escapeHtml(meta.logoDataUrl)}" alt="" /></div>`
      : "";

  const addr = meta.addressLines?.trim()
    ? `<div class="addr">${escapeHtml(meta.addressLines).replace(/\n/g, "<br/>")}</div>`
    : "";
  const legal = meta.legalName?.trim() ? `<div class="legal">${escapeHtml(meta.legalName)}</div>` : "";
  const tax = meta.taxId?.trim() ? `<div class="tax">Tax ID: ${escapeHtml(meta.taxId.trim())}</div>` : "";
  const phone = meta.phone?.trim() ? `<div class="phone">${escapeHtml(meta.phone.trim())}</div>` : "";

  const rows = sale.lines
    .map(
      (l) => `
    <tr>
      <td class="desc">
        <div class="name">${escapeHtml(l.name)}</div>
        <div class="muted">${escapeHtml(l.sku)} · ${escapeHtml(l.unit)} · ${l.qty} × ${formatReceiptMoney(l.unitPrice)}</div>
      </td>
      <td class="amt">${formatReceiptMoney(l.lineTotal)}</td>
    </tr>`,
    )
    .join("");

  const payments = sale.payments
    .map(
      (p) =>
        `<tr><td>${escapeHtml(paymentLabel(p.method))}</td><td class="amt">${formatReceiptMoney(p.amount)}</td></tr>`,
    )
    .join("");

  const footer = meta.footerMessage?.trim()
    ? `<footer class="foot"><div class="foot-inner">${escapeHtml(meta.footerMessage).replace(/\n/g, "<br/>")}</div></footer>`
    : "";

  const fiscalSig = meta.fiscalSignature?.trim()
    ? `<div class="fiscal"><div class="fh">Fiscal / verification</div><pre class="fp">${escapeHtml(meta.fiscalSignature)}</pre></div>`
    : "";

  const qr =
    meta.fiscalQrDataUrl && meta.fiscalQrDataUrl.startsWith("data:")
      ? `<div class="qrbox"><div class="fh">Scan to verify (OQR)</div><img class="qr" src="${escapeHtml(meta.fiscalQrDataUrl)}" alt="Verification QR" /></div>`
      : meta.fiscalQrPayload?.trim()
        ? `<div class="qrbox"><div class="fh">Verification payload</div><pre class="fp small">${escapeHtml(meta.fiscalQrPayload)}</pre></div>`
        : "";

  const wm = opts.reprintWatermark
    ? `<div class="reprint-wm" aria-hidden="true">Reprint</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Receipt ${escapeHtml(sale.receiptNumber)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: ui-monospace, "Cascadia Code", Consolas, monospace;
    margin: 0 auto;
    padding: 10mm;
    max-width: 80ch;
    color: #111;
    font-size: 11px;
    line-height: 1.35;
    position: relative;
  }
  .reprint-wm {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: system-ui, "Segoe UI", Roboto, sans-serif;
    font-size: clamp(48px, 14vw, 120px);
    font-weight: 800;
    letter-spacing: 0.06em;
    color: rgba(180, 60, 60, 0.11);
    transform: rotate(-32deg);
    pointer-events: none;
    z-index: 1000;
    user-select: none;
  }
  h1 { font-family: system-ui, Segoe UI, Roboto, sans-serif; font-size: 15px; margin: 0 0 6px; font-weight: 700; text-align: center; }
  .logo { text-align: center; margin-bottom: 8px; }
  .logo img { max-height: 48px; max-width: 160px; object-fit: contain; }
  .rn { font-size: 13px; font-weight: 700; letter-spacing: 0.06em; text-align: center; font-family: inherit; }
  .meta { color: #333; font-size: 10px; margin: 6px 0 10px; text-align: center; }
  .legal, .tax, .phone, .addr { text-align: center; font-size: 10px; color: #333; margin: 2px 0; }
  .void { background: #fee; color: #900; font-weight: 700; text-align: center; padding: 6px; margin-bottom: 10px; border: 1px solid #c00; font-family: system-ui, sans-serif; }
  table.lines { width: 100%; border-collapse: collapse; margin: 8px 0; }
  table.lines td { vertical-align: top; padding: 6px 0; border-bottom: 1px solid #ddd; }
  tr.del td { border-bottom-color: #bbb; background: #fafafa; }
  td.desc { width: 70%; }
  td.amt { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .name { font-weight: 600; font-family: system-ui, sans-serif; }
  .muted { color: #555; font-size: 10px; margin-top: 2px; font-family: inherit; }
  table.totals { width: 100%; margin-top: 10px; font-variant-numeric: tabular-nums; }
  table.totals td { padding: 3px 0; font-family: inherit; }
  table.totals td:last-child { text-align: right; font-weight: 600; }
  .grand td { font-size: 12px; padding-top: 8px; border-top: 2px solid #111; font-weight: 700; }
  footer.foot { margin-top: 14px; padding-top: 10px; border-top: 1px dashed #999; font-size: 10px; color: #333; font-family: system-ui, sans-serif; }
  .foot-inner { text-align: center; line-height: 1.45; }
  .fiscal, .qrbox { margin-top: 12px; font-family: inherit; }
  .fh { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #555; margin-bottom: 4px; font-family: system-ui, sans-serif; }
  pre.fp { margin: 0; white-space: pre-wrap; word-break: break-all; font-size: 9px; color: #222; }
  pre.fp.small { font-size: 8px; }
  .qr { width: 120px; height: 120px; image-rendering: pixelated; }
  @media print { body { padding: 6mm; } }
</style>
</head>
<body>
  ${wm}
  ${voidBanner}
  ${logo}
  <h1>${escapeHtml(store)}</h1>
  ${legal}
  ${tax}
  ${addr}
  ${phone}
  <div class="rn">${escapeHtml(sale.receiptNumber)}</div>
  <div class="meta">${escapeHtml(formatReceiptWhen(sale.createdAt))}${escapeHtml(register)}<br/>Branch: ${escapeHtml(branch)} · ${escapeHtml(sale.status)} · Currency: ${escapeHtml(currency)} · Tax: ${escapeHtml(taxInfo)}</div>
  <table class="lines">${rows}</table>
  <table class="totals">
    <tr><td>Goods subtotal</td><td>${formatReceiptMoney(sale.subtotal)}</td></tr>
    ${sale.deliveryFee > 0 ? `<tr><td>Delivery (iDeliver)</td><td>${formatReceiptMoney(sale.deliveryFee)}</td></tr>` : ""}
    ${
      sale.salesTaxAmount && sale.salesTaxAmount > 0
        ? (() => {
            const tl = readTaxOnSalesSettings().taxLabel;
            const pct = sale.taxRatePercentSnapshot != null ? ` (${sale.taxRatePercentSnapshot}%)` : "";
            const incl = sale.pricesTaxInclusiveSnapshot ? " · incl. in prices" : "";
            return `<tr><td>${escapeHtml(`${tl}${pct}${incl}`)}</td><td>${formatReceiptMoney(sale.salesTaxAmount)}</td></tr>`;
          })()
        : ""
    }
    <tr class="grand"><td>Amount due</td><td>${formatReceiptMoney(sale.amountDue)}</td></tr>
  </table>
  <table class="totals">
    ${payments}
    <tr><td>Total paid</td><td>${formatReceiptMoney(sale.totalPaid)}</td></tr>
    <tr class="grand"><td>Change</td><td>${formatReceiptMoney(sale.changeDue)}</td></tr>
  </table>
  ${footer}
  ${fiscalSig}
  ${qr}
</body>
</html>`;
}
