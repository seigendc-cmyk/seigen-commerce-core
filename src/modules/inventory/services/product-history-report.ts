import { jsPDF } from "jspdf";
import type { ProductHistoryRow } from "@/modules/inventory/services/product-history";

function money(n: number | null) {
  if (n === null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function safeFilenamePart(s: string) {
  return s.replace(/[^a-zA-Z0-9-_]+/g, "_").replace(/^_|_$/g, "") || "report";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type ProductHistoryRunningRow = ProductHistoryRow & {
  runningQty: number | null;
  runningCost: number | null;
};

export function buildProductHistoryPrintHtml(input: {
  title: string;
  subtitle: string;
  generatedAt: string;
  filtersLabel: string;
  rows: ProductHistoryRunningRow[];
}): string {
  const rows = input.rows
    .map(
      (r) => `<tr>
<td>${escapeHtml(new Date(r.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }))}</td>
<td>${escapeHtml(r.kind)}</td>
<td>${escapeHtml(r.branchName)}</td>
<td>${escapeHtml(r.ref)}</td>
<td class="num">${r.qtyDelta == null ? "—" : r.qtyDelta > 0 ? `+${r.qtyDelta}` : String(r.qtyDelta)}</td>
<td class="num">${money(r.amount)}</td>
<td class="num">${r.runningQty == null ? "—" : String(r.runningQty)}</td>
<td class="num">${money(r.runningCost)}</td>
</tr>`,
    )
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(input.title)}</title>
<style>
body{font-family:system-ui,sans-serif;padding:24px;color:#111;font-size:12px;}
h1{font-size:18px;margin:0;}
.sub{margin-top:4px;color:#444;}
.meta{margin-top:8px;color:#555;font-size:11px;}
table{border-collapse:collapse;width:100%;margin-top:12px;font-size:11px;}
th,td{border:1px solid #ddd;padding:6px 8px;vertical-align:top;}
th{background:#f4f4f4;text-align:left;}
.num{text-align:right;font-variant-numeric:tabular-nums;}
@media print{body{padding:12px;}}
</style></head><body>
<h1>${escapeHtml(input.title)}</h1>
<div class="sub">${escapeHtml(input.subtitle)}</div>
<div class="meta">Generated ${escapeHtml(input.generatedAt)} · ${escapeHtml(input.filtersLabel)}</div>
<table>
<thead>
<tr>
<th>When</th><th>Type</th><th>Branch</th><th>Ref</th>
<th class="num">Qty Δ</th><th class="num">Cost/Amount</th>
<th class="num">Running qty</th><th class="num">Running cost</th>
</tr>
</thead>
<tbody>${rows}</tbody>
</table>
<script>window.onload=function(){window.print();}</script>
</body></html>`;
}

export function openProductHistoryPrintWindow(input: Parameters<typeof buildProductHistoryPrintHtml>[0]) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(buildProductHistoryPrintHtml(input));
  w.document.close();
}

function rowsToLines(rows: ProductHistoryRunningRow[]): string[] {
  const out: string[] = [];
  out.push("When | Type | Branch | Ref | Qty Δ | Amount | Run qty | Run cost");
  for (const r of rows) {
    out.push(
      `${new Date(r.at).toLocaleString()} | ${r.kind} | ${r.branchName} | ${r.ref} | ${r.qtyDelta ?? "—"} | ${money(r.amount)} | ${r.runningQty ?? "—"} | ${money(r.runningCost)}`,
    );
  }
  return out;
}

export async function downloadProductHistoryPdf(input: Parameters<typeof buildProductHistoryPrintHtml>[0]): Promise<void> {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const margin = 36;
  const pageW = doc.internal.pageSize.getWidth();
  const maxW = pageW - margin * 2;
  let y = margin;
  const lineH = 10;
  doc.setFont("courier", "normal");
  doc.setFontSize(8);

  const lines: string[] = [];
  lines.push(input.title);
  lines.push(input.subtitle);
  lines.push(`Generated: ${input.generatedAt}`);
  lines.push(input.filtersLabel);
  lines.push("");
  lines.push(...rowsToLines(input.rows));

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

  const stamp = safeFilenamePart(new Date().toISOString().slice(0, 10));
  doc.save(`seiGEN-product-history-${stamp}.pdf`);
}

export async function shareProductHistoryPdf(
  input: Parameters<typeof buildProductHistoryPrintHtml>[0],
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (typeof navigator === "undefined" || !navigator.share) {
    return { ok: false, reason: "Web Share not available — use Download PDF or Print." };
  }

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const margin = 36;
  const pageW = doc.internal.pageSize.getWidth();
  const maxW = pageW - margin * 2;
  let y = margin;
  const lineH = 9;
  doc.setFont("courier", "normal");
  doc.setFontSize(7);

  const lines: string[] = [];
  lines.push(input.title);
  lines.push(input.subtitle);
  lines.push(`Generated: ${input.generatedAt}`);
  lines.push(input.filtersLabel);
  lines.push("");
  lines.push(...rowsToLines(input.rows));

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

  const blob = doc.output("blob");
  const file = new File([blob], `seiGEN-product-history-${safeFilenamePart(new Date().toISOString().slice(0, 10))}.pdf`, {
    type: "application/pdf",
  });

  try {
    const can = typeof navigator.canShare === "function" ? navigator.canShare({ files: [file] }) : true;
    if (!can) return { ok: false, reason: "This device cannot share PDF files — try Download PDF." };
    await navigator.share({ title: input.title, text: "seiGEN — product history", files: [file] });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Share cancelled or failed.";
    return { ok: false, reason: msg };
  }
}

