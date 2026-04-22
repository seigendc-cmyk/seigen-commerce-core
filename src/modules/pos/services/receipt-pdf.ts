import { jsPDF } from "jspdf";
import type { Sale } from "../types/pos";
import { formatReceiptPlainText, type ReceiptFormatMeta } from "./receipt-format";

function safeFilenamePart(s: string): string {
  return s.replace(/[^a-zA-Z0-9-_]+/g, "_").replace(/^_|_$/g, "") || "receipt";
}

export type ReceiptPdfOptions = {
  /** Diagonal semi-transparent watermark on every page (e.g. Sales History reprints). */
  reprintWatermark?: boolean;
};

function buildReceiptPdfJsDoc(sale: Sale, meta: ReceiptFormatMeta = {}): jsPDF {
  const body = formatReceiptPlainText(sale, meta);
  const lines = body.split("\n");
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  });

  const margin = 40;
  const pageW = doc.internal.pageSize.getWidth();
  const maxW = pageW - margin * 2;
  let y = margin;
  const lineH = 9;
  const fontSize = 7;
  doc.setFont("courier", "normal");
  doc.setFontSize(fontSize);

  for (const line of lines) {
    const chunks = doc.splitTextToSize(line, maxW);
    for (const chunk of chunks) {
      if (y > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(chunk, margin, y);
      y += lineH;
    }
  }

  if (meta.fiscalQrDataUrl?.startsWith("data:") && meta.fiscalQrPayload?.trim()) {
    if (y > doc.internal.pageSize.getHeight() - 160) {
      doc.addPage();
      y = margin;
    }
    try {
      doc.addImage(meta.fiscalQrDataUrl, "PNG", margin, y, 96, 96, undefined, "FAST");
      y += 104;
    } catch {
      /* ignore image errors */
    }
  }

  return doc;
}

function applyReprintWatermark(doc: jsPDF): void {
  const n = doc.getNumberOfPages();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(54);
    doc.setTextColor(230, 170, 170);
    doc.text("Reprint", pw / 2, ph / 2, { align: "center", baseline: "middle", angle: 38 });
  }
}

/**
 * 80-column style PDF: monospace lines, optional QR image from meta.fiscalQrDataUrl.
 */
export async function buildReceiptPdfBlob(
  sale: Sale,
  meta: ReceiptFormatMeta = {},
  options?: ReceiptPdfOptions,
): Promise<Blob> {
  const doc = buildReceiptPdfJsDoc(sale, meta);
  if (options?.reprintWatermark) {
    applyReprintWatermark(doc);
  }
  return doc.output("blob");
}

/**
 * Browser download (default download folder).
 */
export async function downloadReceiptPdf(
  sale: Sale,
  meta: ReceiptFormatMeta = {},
  options?: ReceiptPdfOptions,
): Promise<void> {
  const blob = await buildReceiptPdfBlob(sale, meta, options);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const suffix = options?.reprintWatermark ? "-reprint" : "";
  a.download = `${safeFilenamePart(`seiGEN-${sale.receiptNumber}${suffix}`)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
