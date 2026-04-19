import type { Sale } from "../types/pos";
import { formatReceiptPlainText, type ReceiptFormatMeta } from "./receipt-format";
import { downloadReceiptPdf } from "./receipt-pdf";

export { downloadReceiptPdf };

function safeFilenamePart(s: string): string {
  return s.replace(/[^a-zA-Z0-9-_]+/g, "_").replace(/^_|_$/g, "") || "receipt";
}

function triggerDownload(filename: string, mime: string, body: string): void {
  const blob = new Blob([body], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadReceiptTextFile(sale: Sale, meta?: ReceiptFormatMeta): void {
  const base = safeFilenamePart(`seiGEN-${sale.receiptNumber}`);
  const text = formatReceiptPlainText(sale, meta);
  triggerDownload(`${base}.txt`, "text/plain;charset=utf-8", text);
}

export function downloadReceiptJsonFile(sale: Sale): void {
  const base = safeFilenamePart(`seiGEN-${sale.receiptNumber}`);
  const json = `${JSON.stringify(sale, null, 2)}\n`;
  triggerDownload(`${base}.json`, "application/json;charset=utf-8", json);
}
