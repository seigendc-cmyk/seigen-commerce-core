import type { Sale } from "../types/pos";
import { buildReceiptPrintHtmlDocument, type ReceiptFormatMeta } from "./receipt-format";

function openReceiptPrintWindow(html: string): void {
  const w = window.open("", "_blank", "noopener,noreferrer,width=420,height=720");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  requestAnimationFrame(() => {
    setTimeout(() => w.print(), 200);
  });
}

/**
 * Opens a print dialog for a receipt (new window). Pass `meta` with `fiscalQrDataUrl` for OQR in HTML.
 */
export function printReceiptInNewWindow(sale: Sale, meta?: ReceiptFormatMeta): void {
  const html = buildReceiptPrintHtmlDocument(sale, meta);
  openReceiptPrintWindow(html);
}

/**
 * Sales History reprint: same 80-column layout with a visible "Reprint" watermark on the print view.
 */
export function printReceiptReprint(sale: Sale, meta?: ReceiptFormatMeta): void {
  const html = buildReceiptPrintHtmlDocument(sale, meta, { reprintWatermark: true });
  openReceiptPrintWindow(html);
}
