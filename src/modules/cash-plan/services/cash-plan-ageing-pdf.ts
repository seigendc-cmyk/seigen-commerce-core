import { jsPDF } from "jspdf";

function safeFilenamePart(s: string): string {
  return s.replace(/[^a-zA-Z0-9-_]+/g, "_").replace(/^_|_$/g, "") || "cashplan";
}

function money(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

/**
 * Plain-text style PDF (fast + stable on mobile): renders a table as fixed-width columns.
 */
export async function downloadAgeingPdf(input: {
  title: string;
  entityLabel: string;
  bucketLabels: string[];
  rows: Array<{ entityName: string; total: number; bucketValues: number[] }>;
  filenameBase: string;
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const margin = 28;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const maxW = pageW - margin * 2;

  doc.setFont("courier", "normal");
  doc.setFontSize(8);

  const header = `${input.title} — generated ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
  const columns = [input.entityLabel, "Total", ...input.bucketLabels];

  const colWidths = (() => {
    // Simple widths: entity gets most space, buckets share remaining.
    const entityW = Math.min(260, Math.max(180, maxW * 0.28));
    const totalW = 70;
    const remain = Math.max(120, maxW - entityW - totalW);
    const bucketW = remain / Math.max(1, input.bucketLabels.length);
    return [entityW, totalW, ...input.bucketLabels.map(() => bucketW)];
  })();

  function drawRow(y: number, vals: string[], bold = false) {
    doc.setFont("courier", bold ? "bold" : "normal");
    let x = margin;
    for (let i = 0; i < vals.length; i++) {
      const v = vals[i] ?? "";
      const w = colWidths[i] ?? 60;
      const text = doc.splitTextToSize(v, w - 6);
      doc.text(text, x + 3, y);
      x += w;
    }
  }

  let y = margin + 14;
  doc.setFont("courier", "bold");
  doc.text(header, margin, margin);

  drawRow(y, columns, true);
  y += 14;

  for (const r of input.rows) {
    if (y > pageH - margin) {
      doc.addPage();
      y = margin + 14;
      drawRow(y, columns, true);
      y += 14;
    }
    const vals = [r.entityName, money(r.total), ...r.bucketValues.map(money)];
    drawRow(y, vals, false);
    y += 12;
  }

  doc.save(`${safeFilenamePart(input.filenameBase)}.pdf`);
}

