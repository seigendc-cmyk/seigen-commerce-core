import { jsPDF } from "jspdf";
import type { FundsFlowProjection } from "./cash-plan-funds-flow";
import type { CashPlanFlowSheet } from "@/modules/cash-plan/services/cash-plan-funds-flow-sheet";

function money(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function safeFilenamePart(s: string) {
  return s.replace(/[^a-zA-Z0-9-_]+/g, "_").replace(/^_|_$/g, "") || "report";
}

export function buildFundsFlowPrintHtml(input: {
  title: string;
  generatedAt: string;
  openingLiquid: number;
  projection: FundsFlowProjection;
  modeLabel: string;
  indicativeSpendableNote?: string;
}): string {
  const rows = input.projection.weeks
    .map(
      (w) => `<tr>
<td>${escapeHtml(w.label)}</td>
<td class="num">${money(w.debtorInflows)}</td>
<td class="num">${money(w.creditorOutflows)}</td>
<td class="num">${money(w.net)}</td>
<td class="num">${money(w.closingLiquid)}</td>
</tr>`,
    )
    .join("");

  const unsched =
    input.projection.unscheduledDebtorIn > 1e-6 || input.projection.unscheduledCreditorOut > 1e-6
      ? `<p><strong>Outside 7-week window:</strong> debtor ${money(input.projection.unscheduledDebtorIn)} · creditor ${money(input.projection.unscheduledCreditorOut)} (effective dates beyond grid).</p>`
      : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(input.title)}</title>
<style>
body{font-family:system-ui,sans-serif;padding:24px;color:#111;font-size:13px;}
h1{font-size:18px;}
h2{font-size:14px;margin-top:20px;}
table{border-collapse:collapse;width:100%;margin-top:8px;font-size:12px;}
th,td{border:1px solid #ccc;padding:6px 8px;}
th{background:#f4f4f4;text-align:left;}
.num{text-align:right;font-variant-numeric:tabular-nums;}
.meta{color:#444;font-size:12px;}
@media print{body{padding:12px;}}
</style></head><body>
<h1>${escapeHtml(input.title)}</h1>
<p class="meta">Generated ${escapeHtml(input.generatedAt)} · ${escapeHtml(input.modeLabel)}</p>
<p class="meta">Opening liquid (cash + bank): <strong>${money(input.openingLiquid)}</strong></p>
${input.indicativeSpendableNote ? `<p class="meta">${escapeHtml(input.indicativeSpendableNote)}</p>` : ""}
<table><thead><tr><th>Week</th><th>Debtor inflows (proj.)</th><th>Creditor outflows (proj.)</th><th>Net</th><th>Ending liquid</th></tr></thead>
<tbody>${rows}</tbody></table>
${unsched}
<p class="meta">Projection uses CashPlan effective due / collection dates; it does not post to ledgers.</p>
<script>window.onload=function(){window.print();}</script>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function openFundsFlowPrintWindow(input: Parameters<typeof buildFundsFlowPrintHtml>[0]) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(buildFundsFlowPrintHtml(input));
  w.document.close();
}

export async function downloadFundsFlowPdf(input: Parameters<typeof buildFundsFlowPrintHtml>[0]): Promise<void> {
  const lines: string[] = [];
  lines.push(input.title);
  lines.push(`Generated: ${input.generatedAt}`);
  lines.push(`Mode: ${input.modeLabel}`);
  lines.push(`Opening liquid (cash + bank): ${money(input.openingLiquid)}`);
  if (input.indicativeSpendableNote) lines.push(input.indicativeSpendableNote);
  lines.push("");
  lines.push("Week | Debtor in | Creditor out | Net | Ending liquid");
  for (const w of input.projection.weeks) {
    lines.push(
      `${w.label} | ${money(w.debtorInflows)} | ${money(w.creditorOutflows)} | ${money(w.net)} | ${money(w.closingLiquid)}`,
    );
  }
  if (input.projection.unscheduledDebtorIn > 1e-6 || input.projection.unscheduledCreditorOut > 1e-6) {
    lines.push(
      `Outside window: debtor ${money(input.projection.unscheduledDebtorIn)} | creditor ${money(input.projection.unscheduledCreditorOut)}`,
    );
  }
  lines.push("");
  lines.push("Projection uses CashPlan effective dates; illustrative only.");

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const margin = 40;
  const pageW = doc.internal.pageSize.getWidth();
  const maxW = pageW - margin * 2;
  let y = margin;
  const lineH = 10;
  doc.setFont("courier", "normal");
  doc.setFontSize(8);
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
  doc.save(`seiGEN-funds-cash-flow-${stamp}.pdf`);
}

export async function shareFundsFlowPdf(input: Parameters<typeof buildFundsFlowPrintHtml>[0]): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (typeof navigator === "undefined" || !navigator.share) {
    return { ok: false, reason: "Web Share not available — use Download PDF or Print." };
  }

  const lines: string[] = [];
  lines.push(input.title);
  lines.push(`Generated: ${input.generatedAt}`);
  lines.push(`Opening liquid: ${money(input.openingLiquid)}`);
  for (const w of input.projection.weeks) {
    lines.push(`${w.label}: in ${money(w.debtorInflows)} out ${money(w.creditorOutflows)} end ${money(w.closingLiquid)}`);
  }

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const margin = 40;
  const pageW = doc.internal.pageSize.getWidth();
  const maxW = pageW - margin * 2;
  let y = margin;
  const lineH = 9;
  doc.setFont("courier", "normal");
  doc.setFontSize(7);
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
  const file = new File([blob], `seiGEN-funds-cash-flow-${safeFilenamePart(new Date().toISOString().slice(0, 10))}.pdf`, {
    type: "application/pdf",
  });

  try {
    const can =
      typeof navigator.canShare === "function"
        ? navigator.canShare({ files: [file] })
        : true;
    if (!can) {
      return { ok: false, reason: "This device cannot share PDF files — try Download PDF." };
    }
    await navigator.share({
      title: input.title,
      text: "seiGEN CashPlan — Funds cash flow projection",
      files: [file],
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Share cancelled or failed.";
    return { ok: false, reason: msg };
  }
}

function htmlDoc(title: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title>
<style>
body{font-family:system-ui,sans-serif;padding:24px;color:#111;font-size:13px;}
h1{font-size:18px;}
table{border-collapse:collapse;width:100%;margin-top:8px;font-size:12px;}
th,td{border:1px solid #ccc;padding:6px 8px;}
th{background:#f4f4f4;text-align:left;}
.num{text-align:right;font-variant-numeric:tabular-nums;}
.meta{color:#444;font-size:12px;}
@media print{body{padding:12px;}}
</style></head><body>${body}</body></html>`;
}

export function buildFundsFlowSheetPrintHtml(input: {
  title: string;
  generatedAt: string;
  sheet: CashPlanFlowSheet;
  note?: string;
}): string {
  const head = `<h1>${escapeHtml(input.title)}</h1>
<p class="meta">Generated ${escapeHtml(input.generatedAt)}</p>
${input.note ? `<p class=\"meta\">${escapeHtml(input.note)}</p>` : ""}`;

  const headerCols = input.sheet.columns.map((c) => `<th class="num">${escapeHtml(c.label)}</th>`).join("");
  const bodyRows = input.sheet.rows
    .map((r) => {
      const cells = input.sheet.columns
        .map((c) => `<td class="num">${money(r.cells[c.key] ?? 0)}</td>`)
        .join("");
      return `<tr><td>${escapeHtml(r.label)}</td>${cells}<td class="num">${money(r.total)}</td></tr>`;
    })
    .join("");

  const footer = `<tr>
<th>${escapeHtml(input.sheet.totalsRowLabel)}</th>
${input.sheet.columns.map((c) => `<th class=\"num\">${money(input.sheet.totals[c.key] ?? 0)}</th>`).join("")}
<th class="num">${money(input.sheet.grandTotal)}</th>
</tr>`;

  const table = `<table>
<thead><tr><th>Line</th>${headerCols}<th class="num">Total</th></tr></thead>
<tbody>${bodyRows}</tbody>
<tfoot>${footer}</tfoot>
</table>`;

  return htmlDoc(input.title, `${head}${table}<script>window.onload=function(){window.print();}</script>`);
}

export function openFundsFlowSheetPrintWindow(input: Parameters<typeof buildFundsFlowSheetPrintHtml>[0]) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(buildFundsFlowSheetPrintHtml(input));
  w.document.close();
}

export async function downloadFundsFlowSheetPdf(input: Parameters<typeof buildFundsFlowSheetPrintHtml>[0]): Promise<void> {
  const colKeys = input.sheet.columns.map((c) => c.key);
  const header = ["Line", ...input.sheet.columns.map((c) => c.label), "Total"];

  const lines: string[] = [];
  lines.push(input.title);
  lines.push(`Generated: ${input.generatedAt}`);
  if (input.note) lines.push(input.note);
  lines.push("");
  lines.push(header.join(" | "));
  for (const r of input.sheet.rows) {
    const cells = colKeys.map((k) => money(r.cells[k] ?? 0));
    lines.push([r.label, ...cells, money(r.total)].join(" | "));
  }
  const totals = colKeys.map((k) => money(input.sheet.totals[k] ?? 0));
  lines.push([input.sheet.totalsRowLabel, ...totals, money(input.sheet.grandTotal)].join(" | "));

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const margin = 36;
  const pageW = doc.internal.pageSize.getWidth();
  const maxW = pageW - margin * 2;
  let y = margin;
  const lineH = 10;
  doc.setFont("courier", "normal");
  doc.setFontSize(8);
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
  doc.save(`seiGEN-funds-cash-flow-sheet-${stamp}.pdf`);
}

export async function shareFundsFlowSheetPdf(
  input: Parameters<typeof buildFundsFlowSheetPrintHtml>[0],
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (typeof navigator === "undefined" || !navigator.share) {
    return { ok: false, reason: "Web Share not available — use Download PDF or Print." };
  }

  const colKeys = input.sheet.columns.map((c) => c.key);
  const lines: string[] = [];
  lines.push(input.title);
  lines.push(`Generated: ${input.generatedAt}`);
  if (input.note) lines.push(input.note);
  lines.push("");
  lines.push(["Line", ...input.sheet.columns.map((c) => c.label), "Total"].join(" | "));
  for (const r of input.sheet.rows) {
    const cells = colKeys.map((k) => money(r.cells[k] ?? 0));
    lines.push([r.label, ...cells, money(r.total)].join(" | "));
  }
  const totals = colKeys.map((k) => money(input.sheet.totals[k] ?? 0));
  lines.push([input.sheet.totalsRowLabel, ...totals, money(input.sheet.grandTotal)].join(" | "));

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const margin = 36;
  const pageW = doc.internal.pageSize.getWidth();
  const maxW = pageW - margin * 2;
  let y = margin;
  const lineH = 9;
  doc.setFont("courier", "normal");
  doc.setFontSize(7);
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
  const file = new File(
    [blob],
    `seiGEN-funds-cash-flow-sheet-${safeFilenamePart(new Date().toISOString().slice(0, 10))}.pdf`,
    { type: "application/pdf" },
  );

  try {
    const can = typeof navigator.canShare === "function" ? navigator.canShare({ files: [file] }) : true;
    if (!can) return { ok: false, reason: "This device cannot share PDF files — try Download PDF." };
    await navigator.share({
      title: input.title,
      text: "seiGEN CashPlan — Funds cash flow sheet",
      files: [file],
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Share cancelled or failed.";
    return { ok: false, reason: msg };
  }
}
