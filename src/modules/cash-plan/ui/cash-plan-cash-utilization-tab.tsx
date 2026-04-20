"use client";

import { useMemo, useState } from "react";
import type { CashPlanSnapshot } from "@/modules/cash-plan/services/cash-plan-snapshot";
import { buildCashUtilizationSheet } from "@/modules/cash-plan/services/cash-plan-cash-utilization-sheet";
import { type FlowPeriod } from "@/modules/cash-plan/services/cash-plan-funds-flow-sheet";
import {
  downloadFundsFlowSheetPdf,
  openFundsFlowSheetPrintWindow,
  shareFundsFlowSheetPdf,
} from "@/modules/cash-plan/services/cash-plan-funds-flow-report";
import { outstandingCreditorsWithDueDates } from "@/modules/financial/services/creditor-due";
import { outstandingDebtorsWithDueDates } from "@/modules/financial/services/debtor-due";
import { listCreditorEntries, listOutstandingCreditors } from "@/modules/financial/services/creditors-ledger";
import { listDebtorEntries, listOutstandingDebtors } from "@/modules/financial/services/debtors-ledger";

function money(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function CashPlanCashUtilizationTab({ dataVersion, snap }: { dataVersion: string; snap: CashPlanSnapshot }) {
  const [period, setPeriod] = useState<FlowPeriod>("week");
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  const { creditorRows, debtorRows } = useMemo(() => {
    const creditorEntries = listCreditorEntries(500);
    const debtorEntries = listDebtorEntries(500);
    const outstanding = listOutstandingCreditors();
    const outstandingDebtors = listOutstandingDebtors();
    const cr = outstandingCreditorsWithDueDates(outstanding, creditorEntries);
    const dr = outstandingDebtorsWithDueDates(outstandingDebtors, debtorEntries);
    return { creditorRows: cr, debtorRows: dr };
  }, [dataVersion]);

  const sheet = useMemo(() => {
    return buildCashUtilizationSheet({ period, creditorRows, debtorRows });
  }, [period, creditorRows, debtorRows]);

  const payload = useMemo(
    () => ({
      title: "seiGEN CashPlan — Cash Utilization",
      generatedAt: new Date().toLocaleString(),
      sheet,
      note: `Period: ${period}. Cash Utilization shows CASH IN - CASH OUT + Op. Bal = Available Cash, split into Cash Book vs Bank for clarity. AR/AP lines are scheduled from CashPlan effective dates.`,
    }),
    [sheet, period],
  );

  return (
    <section className="space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Cash Utilization</h2>
          <p className="mt-1 max-w-3xl text-sm text-neutral-400">
            CASH IN − CASH OUT + Op. Bal (from previous period) = Available Cash. Values are split across{" "}
            <strong className="text-neutral-300">Cash Book</strong> and <strong className="text-neutral-300">Bank</strong>{" "}
            for operational clarity.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs text-neutral-200">
          <span className="text-neutral-500">Period:</span>
          {(["week", "month", "year"] as FlowPeriod[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={
                period === p
                  ? "rounded-md bg-white/15 px-2 py-1 font-semibold text-white"
                  : "rounded-md bg-white/5 px-2 py-1 text-neutral-200 hover:bg-white/10"
              }
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 text-sm text-emerald-100/95">
        <span className="font-medium">Opening liquid (cash + bank):</span>
        <span className="font-mono">{money(snap.totalLiquidCash)}</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-neutral-950/80">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="border-b border-white/10 bg-neutral-950 text-xs font-semibold uppercase tracking-wide text-neutral-300">
            <tr>
              <th className="sticky left-0 z-10 bg-neutral-950 px-3 py-2 text-neutral-200">Header / account</th>
              {sheet.columns.map((c) => (
                <th key={c.key} className="px-3 py-2 text-right text-neutral-200">
                  {c.label}
                </th>
              ))}
              <th className="px-3 py-2 text-right text-neutral-200">Total</th>
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((r) => {
              const isHeader = r.id.startsWith("hdr_");
              return (
                <tr
                  key={r.id}
                  className={[
                    "border-b border-white/[0.06] last:border-0",
                    isHeader ? "bg-white/[0.04]" : "",
                  ].join(" ")}
                >
                  <td
                    className={[
                      "sticky left-0 z-10 px-3 py-2",
                      isHeader ? "bg-neutral-900 font-semibold text-white" : "bg-neutral-950 text-neutral-100",
                    ].join(" ")}
                  >
                    {r.label}
                  </td>
                  {sheet.columns.map((c) => (
                    <td
                      key={`${r.id}:${c.key}`}
                      className={[
                        "px-3 py-2 text-right font-mono tabular-nums",
                        isHeader
                          ? "text-neutral-100"
                          : r.kind === "revenue"
                            ? "text-sky-200/95"
                            : r.kind === "expense"
                              ? "text-rose-200/95"
                              : "text-neutral-100",
                      ].join(" ")}
                    >
                      {r.cells[c.key] != null ? money(r.cells[c.key] ?? 0) : isHeader ? "" : money(0)}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-mono font-semibold text-neutral-100">{money(r.total)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t border-white/10 bg-neutral-950">
            <tr>
              <th className="sticky left-0 z-10 bg-neutral-950 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-300">
                {sheet.totalsRowLabel}
              </th>
              {sheet.columns.map((c) => (
                <th key={`tot:${c.key}`} className="px-3 py-2 text-right font-mono text-xs font-semibold text-neutral-100">
                  {money(sheet.totals[c.key] ?? 0)}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-mono text-xs font-semibold text-neutral-100">{money(sheet.grandTotal)}</th>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
          onClick={() => openFundsFlowSheetPrintWindow(payload)}
        >
          Print / Save as PDF
        </button>
        <button
          type="button"
          className="rounded-lg border border-brand-orange/50 bg-brand-orange/15 px-4 py-2 text-sm font-semibold text-brand-orange hover:bg-brand-orange/25"
          onClick={() => void downloadFundsFlowSheetPdf(payload)}
        >
          Download PDF
        </button>
        <button
          type="button"
          className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-neutral-200 hover:bg-white/5"
          onClick={() => {
            setShareMsg(null);
            void shareFundsFlowSheetPdf(payload).then((r) => {
              if (!r.ok) setShareMsg(r.reason);
            });
          }}
        >
          Share PDF (WhatsApp / Telegram…)
        </button>
      </div>
      {shareMsg ? <p className="text-xs text-amber-200/90">{shareMsg}</p> : null}
      <p className="text-xs text-neutral-600">
        Mobile: Share opens the system sheet — pick WhatsApp or Telegram if installed. Desktop may save or open the PDF
        depending on browser; Download PDF is always reliable.
      </p>
    </section>
  );
}

