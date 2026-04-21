"use client";

import { useEffect, useMemo, useState } from "react";
import type { CashPlanSnapshot } from "@/modules/cash-plan/services/cash-plan-snapshot";
import {
  buildFundsFlowProjection,
  buildFundsFlowProjectionCappedByLiquid,
} from "@/modules/cash-plan/services/cash-plan-funds-flow";
import {
  downloadFundsFlowPdf,
  downloadFundsFlowSheetPdf,
  openFundsFlowPrintWindow,
  openFundsFlowSheetPrintWindow,
  shareFundsFlowPdf,
  shareFundsFlowSheetPdf,
} from "@/modules/cash-plan/services/cash-plan-funds-flow-report";
import {
  addCashPlanUserFlowProjection,
  CASHPLAN_FLOW_USER_PROJECTIONS_UPDATED,
  listCashPlanUserFlowProjections,
  updateCashPlanUserFlowProjectionCell,
} from "@/modules/cash-plan/services/cash-plan-flow-user-projections";
import { buildCashPlanFlowSheet, type FlowPeriod } from "@/modules/cash-plan/services/cash-plan-funds-flow-sheet";
import { outstandingCreditorsWithDueDates } from "@/modules/financial/services/creditor-due";
import { outstandingDebtorsWithDueDates } from "@/modules/financial/services/debtor-due";
import {
  listCreditorEntries,
  listOutstandingCreditors,
} from "@/modules/financial/services/creditors-ledger";
import { listDebtorEntries, listOutstandingDebtors } from "@/modules/financial/services/debtors-ledger";

function money(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function CashPlanFundsFlowTab({
  dataVersion,
  snap,
}: {
  dataVersion: string;
  snap: CashPlanSnapshot;
}) {
  const [respectLiquid, setRespectLiquid] = useState(false);
  const [period, setPeriod] = useState<FlowPeriod>("week");
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [projTick, setProjTick] = useState(0);

  useEffect(() => {
    const onAny = () => setProjTick((t) => t + 1);
    window.addEventListener(CASHPLAN_FLOW_USER_PROJECTIONS_UPDATED, onAny);
    return () => window.removeEventListener(CASHPLAN_FLOW_USER_PROJECTIONS_UPDATED, onAny);
  }, []);

  const { creditorRows, debtorRows } = useMemo(() => {
    const creditorEntries = listCreditorEntries(500);
    const debtorEntries = listDebtorEntries(500);
    const outstanding = listOutstandingCreditors();
    const outstandingDebtors = listOutstandingDebtors();
    const cr = outstandingCreditorsWithDueDates(outstanding, creditorEntries);
    const dr = outstandingDebtorsWithDueDates(outstandingDebtors, debtorEntries);
    return { creditorRows: cr, debtorRows: dr };
  }, [dataVersion]);

  const projection = useMemo(() => {
    const opening = snap.totalLiquidCash;
    if (respectLiquid) {
      return buildFundsFlowProjectionCappedByLiquid({
        openingLiquid: opening,
        creditorRows,
        debtorRows,
      });
    }
    return buildFundsFlowProjection({
      openingLiquid: opening,
      creditorRows,
      debtorRows,
    });
  }, [snap.totalLiquidCash, creditorRows, debtorRows, respectLiquid]);

  const modeLabel = respectLiquid
    ? "Liquidity-aware (creditor outflows capped by projected cash; overflow rolls forward)"
    : "Scheduled dates (full balances placed in effective due / collection weeks)";

  const userProjections = useMemo(() => {
    void projTick;
    return listCashPlanUserFlowProjections();
  }, [projTick]);

  const sheet = useMemo(() => {
    return buildCashPlanFlowSheet({
      period,
      fundsFlowProjection: projection,
      userProjections,
    });
  }, [period, projection, userProjections]);

  const reportPayload = useMemo(
    () => ({
      title: "seiGEN CashPlan — Funds cash flow",
      generatedAt: new Date().toLocaleString(),
      openingLiquid: projection.openingLiquid,
      projection,
      modeLabel,
      indicativeSpendableNote:
        snap.indicativeSpendableAfterCashPlanReserves != null
          ? `Indicative spendable after COGS, AP & CashPlan reserves (informational): ${money(snap.indicativeSpendableAfterCashPlanReserves)}`
          : undefined,
    }),
    [projection, modeLabel, snap.indicativeSpendableAfterCashPlanReserves],
  );

  const sheetReportPayload = useMemo(
    () => ({
      title: "seiGEN CashPlan — Funds cash flow sheet",
      generatedAt: new Date().toLocaleString(),
      sheet,
      note: `Period: ${period}. Receipts and payments are sourced from CashBook/Bank entries and journal batches (local-first). User projections are manual.`,
    }),
    [sheet, period],
  );

  return (
    <section className="space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Funds cash flow</h2>
          <p className="mt-1 max-w-3xl text-sm text-neutral-400">
            Seven weekly columns: <strong className="text-neutral-300">one full week lookback</strong>, then the{" "}
            <strong className="text-neutral-300">current week plus five weeks ahead</strong> (six forward-looking weeks).
            Inflows and outflows use the same <strong className="text-neutral-300">effective dates</strong> as
            the rest of CashPlan (calendars + schedules). Opening position uses{" "}
            <strong className="text-neutral-300">cash + bank</strong> from your snapshot.
          </p>
        </div>
        <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-200">
            <input
              type="checkbox"
              checked={respectLiquid}
              onChange={(e) => setRespectLiquid(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-black/40"
            />
            Project payments within liquid cash (roll unpaid AP forward)
          </label>
          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-300">
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
          <p className="text-[11px] text-neutral-500">
            Off = full obligations on scheduled weeks. On = pay creditors only while projected balance stays funded;
            shortfalls move to later weeks (planning only).
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 text-sm text-emerald-100/95">
        <span className="font-medium">Opening liquid:</span>
        <span className="font-mono">{money(projection.openingLiquid)}</span>
        <span className="text-emerald-200/70">· Indicative spendable (strict):</span>
        <span className="font-mono text-emerald-50">{money(snap.indicativeSpendableAfterCashPlanReserves)}</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-white/10 bg-neutral-950/80">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="border-b border-white/10 bg-neutral-950 text-xs font-semibold uppercase tracking-wide text-neutral-300">
            <tr>
              <th className="sticky left-0 z-10 bg-neutral-950 px-3 py-2 text-neutral-200">Line</th>
              {sheet.columns.map((c) => (
                <th key={c.key} className="px-3 py-2 text-right text-neutral-200">
                  {c.label}
                </th>
              ))}
              <th className="px-3 py-2 text-right text-neutral-200">Total</th>
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((r) => (
              <tr key={r.id} className="border-b border-white/[0.06] last:border-0">
                <td className="sticky left-0 z-10 bg-neutral-950 px-3 py-2 text-neutral-100">{r.label}</td>
                {sheet.columns.map((c) => {
                  const v = r.cells[c.key] ?? 0;
                  const isProj = r.kind === "projection" && r.id.startsWith("proj:");
                  return (
                    <td key={`${r.id}:${c.key}`} className="px-3 py-1.5 text-right font-mono">
                      {isProj ? (
                        <input
                          inputMode="decimal"
                          className="w-28 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-right font-mono text-sm text-white outline-none focus:border-teal-500/60"
                          value={v ? String(v) : ""}
                          placeholder="0"
                          onChange={(e) => {
                            const raw = e.target.value.trim();
                            const n = raw === "" ? null : Number(raw);
                            updateCashPlanUserFlowProjectionCell(
                              r.id.slice("proj:".length),
                              c.key,
                              n != null && Number.isFinite(n) ? n : null,
                            );
                          }}
                        />
                      ) : (
                        <span
                          className={
                            r.kind === "revenue"
                              ? "text-sky-200/95"
                              : r.kind === "expense"
                                ? "text-rose-200/95"
                                : "text-neutral-100"
                          }
                        >
                          {money(v)}
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-right font-mono font-semibold text-neutral-100">{money(r.total)}</td>
              </tr>
            ))}
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

      {(projection.unscheduledDebtorIn > 1e-6 || projection.unscheduledCreditorOut > 1e-6) && (
        <p className="text-sm text-amber-200/90">
          Amounts with effective dates outside this 7-week grid — debtor {money(projection.unscheduledDebtorIn)} · creditor{" "}
          {money(projection.unscheduledCreditorOut)}. Extend the horizon or adjust schedules in the calendars tab.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
          onClick={() => {
            const label = window.prompt("Projection line name", "Projection");
            if (!label) return;
            const direction = window.confirm("Is this an inflow?\n\nOK = inflow (adds cash)\nCancel = outflow (uses cash)")
              ? "inflow"
              : "outflow";
            addCashPlanUserFlowProjection({ label, direction });
          }}
        >
          Add projection line
        </button>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
            onClick={() => openFundsFlowSheetPrintWindow(sheetReportPayload)}
          >
            Print / Save as PDF
          </button>
          <button
            type="button"
            className="rounded-lg border border-teal-500/50 bg-teal-600/15 px-4 py-2 text-sm font-semibold text-teal-600 hover:bg-teal-600/25"
            onClick={() => void downloadFundsFlowSheetPdf(sheetReportPayload)}
          >
            Download PDF
          </button>
          <button
            type="button"
            className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-neutral-200 hover:bg-white/5"
            onClick={() => {
              setShareMsg(null);
              void shareFundsFlowSheetPdf(sheetReportPayload).then((r) => {
                if (!r.ok) setShareMsg(r.reason);
              });
            }}
          >
            Share PDF (WhatsApp / Telegram…)
          </button>
        </div>
      </div>
      <details className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-neutral-200">Weekly schedule projection (detail)</summary>
        <p className="mt-2 text-xs text-neutral-500">{modeLabel}</p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.04] text-xs font-semibold uppercase tracking-wide text-neutral-400">
              <tr>
                <th className="px-3 py-2">Week</th>
                <th className="px-3 py-2 text-right">Debtor inflows</th>
                <th className="px-3 py-2 text-right">Creditor outflows</th>
                <th className="px-3 py-2 text-right">Net</th>
                <th className="px-3 py-2 text-right">Ending liquid</th>
              </tr>
            </thead>
            <tbody>
              {projection.weeks.map((w) => (
                <tr key={w.index} className="border-b border-white/[0.06]">
                  <td className="px-3 py-2 text-neutral-200">{w.label}</td>
                  <td className="px-3 py-2 text-right font-mono text-sky-200/95">{money(w.debtorInflows)}</td>
                  <td className="px-3 py-2 text-right font-mono text-rose-200/95">{money(w.creditorOutflows)}</td>
                  <td className="px-3 py-2 text-right font-mono text-neutral-200">{money(w.net)}</td>
                  <td
                    className={`px-3 py-2 text-right font-mono ${
                      w.closingLiquid < -1e-6 ? "text-amber-300" : "text-emerald-200/95"
                    }`}
                  >
                    {money(w.closingLiquid)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
            onClick={() => openFundsFlowPrintWindow(reportPayload)}
          >
            Print / Save as PDF (weekly projection)
          </button>
          <button
            type="button"
            className="rounded-lg border border-teal-500/50 bg-teal-600/15 px-4 py-2 text-sm font-semibold text-teal-600 hover:bg-teal-600/25"
            onClick={() => void downloadFundsFlowPdf(reportPayload)}
          >
            Download PDF (weekly projection)
          </button>
          <button
            type="button"
            className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-neutral-200 hover:bg-white/5"
            onClick={() => {
              setShareMsg(null);
              void shareFundsFlowPdf(reportPayload).then((r) => {
                if (!r.ok) setShareMsg(r.reason);
              });
            }}
          >
            Share PDF (weekly projection)
          </button>
        </div>
      </details>

      {shareMsg ? <p className="text-xs text-amber-200/90">{shareMsg}</p> : null}
      <p className="text-xs text-neutral-600">
        Mobile: Share opens the system sheet — pick WhatsApp or Telegram if installed. Desktop may save or open the PDF
        depending on browser; Download PDF is always reliable.
      </p>
    </section>
  );
}
