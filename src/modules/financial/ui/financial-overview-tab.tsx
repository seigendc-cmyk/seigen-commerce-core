"use client";

import Link from "next/link";
import { useMemo } from "react";
import { biRulesLocalStorageKey } from "@/modules/bi/services/bi-rules-local";
import { buildFinancialBiOverview } from "@/modules/financial/services/financial-bi-overview";
import type { FinancialTabId } from "@/modules/financial/financial-nav";

function money(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function severityStyles(s: "info" | "notice" | "warning" | "critical"): string {
  switch (s) {
    case "critical":
      return "border-rose-500/40 bg-rose-500/10 text-rose-100";
    case "warning":
      return "border-amber-500/35 bg-amber-500/10 text-amber-100";
    case "notice":
      return "border-sky-500/30 bg-sky-500/10 text-sky-100";
    default:
      return "border-white/15 bg-white/[0.04] text-neutral-200";
  }
}

export function FinancialOverviewTab({
  tick,
  onSelectTab,
}: {
  tick: number;
  onSelectTab: (id: FinancialTabId) => void;
}) {
  const { kpis, signals, activeFinancialRules } = useMemo(() => buildFinancialBiOverview(), [tick]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-white">Financial oversight</h2>
        <p className="mt-1 max-w-3xl text-sm text-neutral-400">
          This landing view is driven by the <strong className="text-neutral-200">BI business-rules layer</strong>{" "}
          (financial domain) plus live rollups from your local ledgers. Use it as a daily health check before drilling
          into CashBook, creditors, or COGS Reserves.
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {(
          [
            ["Liquid (cash + bank)", kpis.totalLiquidCash, "tab:cashbook", "rose"],
            ["COGS Reserves (Seed)", kpis.cogsReservesBalance, "tab:seed", "emerald"],
            ["Supplier payables (AP)", kpis.supplierPayablesTotal, "tab:creditors", "rose"],
            ["Debtor receivables (AR)", kpis.debtorReceivablesTotal, "href:/dashboard/cash-plan", "sky"],
            ["Laybye goods held", kpis.laybyeGoodsValue, "href:/dashboard/cash-plan", "amber"],
            ["Indicative free cash", kpis.indicativeFreeCash, "tab:cashbook", "violet"],
            ["Spendable (after reserves)", kpis.indicativeSpendableAfterCashPlanReserves, "tab:seed", "teal"],
            ["CashPlan discipline reserves", kpis.cashPlanReservesTotal, "href:/dashboard/cash-plan", "violet"],
            ["Output tax (tracked)", kpis.outputTaxTracked, "tab:cashbook", "neutral"],
            ["Input tax (tracked)", kpis.inputTaxTracked, "tab:cashbook", "neutral"],
          ] as const
        ).map(([label, value, action, tone]) => {
          const className = `block rounded-2xl border p-4 text-left transition hover:ring-2 hover:ring-brand-orange/30 ${
            tone === "emerald"
              ? "border-emerald-500/25 bg-emerald-500/[0.07]"
              : tone === "rose"
                ? "border-rose-500/25 bg-rose-500/[0.07]"
                : tone === "sky"
                  ? "border-sky-500/25 bg-sky-500/[0.07]"
                  : tone === "amber"
                    ? "border-amber-500/25 bg-amber-500/[0.07]"
                    : tone === "teal"
                      ? "border-teal-500/25 bg-teal-500/[0.07]"
                      : tone === "violet"
                        ? "border-violet-500/25 bg-violet-500/[0.07]"
                        : "border-white/10 bg-white/[0.04]"
          }`;
          const inner = (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
              <p className="mt-2 font-mono text-xl font-bold text-white">{money(value)}</p>
              <p className="mt-2 text-[11px] text-neutral-500">
                {action.startsWith("href:") ? "Open in CashPlan →" : "Open related tab →"}
              </p>
            </>
          );
          if (action.startsWith("href:")) {
            return (
              <Link key={label} href={action.slice(5)} className={className}>
                {inner}
              </Link>
            );
          }
          const tab = action.replace("tab:", "") as FinancialTabId;
          return (
            <button key={label} type="button" onClick={() => onSelectTab(tab)} className={className}>
              {inner}
            </button>
          );
        })}
      </section>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link
          href="/dashboard/cash-plan"
          className="rounded-lg border border-white/15 px-4 py-2 font-semibold text-brand-orange hover:bg-white/5"
        >
          CashPlan →
        </Link>
        <Link
          href="/dashboard/bi/rules"
          className="rounded-lg border border-white/15 px-4 py-2 font-semibold text-neutral-200 hover:bg-white/5"
        >
          BI business rules →
        </Link>
      </div>

      {signals.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">BI signals</h3>
          <ul className="space-y-2">
            {signals.map((s) => (
              <li
                key={s.id}
                className={`rounded-xl border px-4 py-3 text-sm ${severityStyles(s.severity)}`}
              >
                <p className="font-semibold">{s.title}</p>
                <p className="mt-1 text-xs opacity-95">{s.detail}</p>
                <p className="mt-2 text-[10px] uppercase tracking-wide text-neutral-500">
                  {s.source === "engine" ? "Rules engine" : "BI rule"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-neutral-400">
          No automated signals right now — totals look within neutral ranges, or financial BI rules are inactive.
        </p>
      )}

      <section className="vendor-panel-soft rounded-2xl p-6">
        <h3 className="text-base font-semibold text-white">BI layer — financial rules</h3>
        <p className="mt-1 text-sm text-neutral-400">
          Active rules below inform highlights and engine checks. Manage all domains under{" "}
          <Link href="/dashboard/bi/rules" className="font-semibold text-brand-orange hover:underline">
            BI → Business rules
          </Link>
          . Storage: <span className="font-mono text-xs text-neutral-600">{biRulesLocalStorageKey()}</span>
        </p>
        {activeFinancialRules.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-500">No active financial rules — enable templates or add your own.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {activeFinancialRules.map((r) => (
              <li key={r.id} className="rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm">
                <p className="font-medium text-neutral-100">{r.title}</p>
                <p className="mt-1 text-xs text-neutral-500">{r.ruleKey}</p>
                <p className="mt-2 text-xs text-neutral-400">{r.description}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
