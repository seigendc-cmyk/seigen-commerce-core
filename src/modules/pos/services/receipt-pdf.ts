import { jsPDF } from "jspdf";
import type { Sale } from "../types/pos";
import { formatReceiptPlainText, type ReceiptFormatMeta } from "./receipt-format";

function safeFilenamePart(s: string): string {
  return s.replace(/[^a-zA-Z0-9-_]+/g, "_").replace(/^_|_$/g, "") || "receipt";
}

/**
 * 80-column style PDF: monospace lines, optional QR image from meta.fiscalQrDataUrl.
 */
export async function downloadReceiptPdf(sale: Sale, meta: ReceiptFormatMeta = {}): Promise<void> {
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

  const base = safeFilenamePart(`seiGEN-${sale.receiptNumber}`);
  doc.save(`${base}.pdf`);
}
