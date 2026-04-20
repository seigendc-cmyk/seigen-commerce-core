"use client";

import Link from "next/link";
import type { CashPlanSnapshot } from "@/modules/cash-plan/services/cash-plan-snapshot";

function money(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

/**
 * Read-only “discipline” view: same numbers as Financial ledgers, reinterpreted for decisions.
 * Does not post transactions or change creditor / COGS logic.
 */
export function CashPlanLiquidityDiscipline({ snap }: { snap: CashPlanSnapshot }) {
  return (
    <section className="rounded-2xl border border-slate-700/40 bg-gradient-to-br from-slate-900/80 to-neutral-950/90 p-4 shadow-lg sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-emerald-200/95">Liquidity &amp; discipline</h2>
          <p className="mt-1 max-w-2xl text-sm text-neutral-400">
            Derived in real time from your <span className="text-neutral-300">Cash Book</span>,{" "}
            <span className="text-neutral-300">Bank</span>, <span className="text-neutral-300">COGS Reserves</span>, and{" "}
            <span className="text-neutral-300">supplier payables</span> — the same ledgers as Financial. Nothing here
            posts new entries; it breaks cash into layers so you don’t confuse sales with safe-to-spend money.
          </p>
        </div>
        <Link
          href="/dashboard/financial?tab=cashbook"
          className="shrink-0 self-start rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-brand-orange hover:border-brand-orange"
        >
          Open Financial →
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 sm:p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Liquid (cash + bank)</p>
          <p className="mt-2 font-mono text-xl font-bold text-white sm:text-2xl">{money(snap.totalLiquidCash)}</p>
          <p className="mt-1 text-[11px] text-neutral-500">
            {money(snap.cashOnHand)} cash · {money(snap.bankBalance)} bank
          </p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.07] p-3 sm:p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/90">COGS pool</p>
          <p className="mt-2 font-mono text-xl font-bold text-amber-100 sm:text-2xl">{money(snap.cogsReservesBalance)}</p>
          <p className="mt-1 text-[11px] text-amber-200/70">Stock funding (Seed Account)</p>
        </div>
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.07] p-3 sm:p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-200/90">Suppliers (AP)</p>
          <p className="mt-2 font-mono text-xl font-bold text-rose-100 sm:text-2xl">{money(snap.supplierPayablesTotal)}</p>
          <p className="mt-1 text-[11px] text-rose-200/70">Owed on credit POs</p>
        </div>
        <div className="col-span-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] p-3 sm:col-span-1 sm:p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-200/95">After payables (indic.)</p>
          <p className="mt-2 font-mono text-xl font-bold text-emerald-100 sm:text-2xl">{money(snap.indicativeCashAfterPayables)}</p>
          <p className="mt-1 text-[11px] text-emerald-200/70">If AP settled from till/bank only</p>
        </div>
        <div className="col-span-2 rounded-xl border border-sky-500/30 bg-sky-500/[0.10] p-3 sm:col-span-2 lg:col-span-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-200/95">True free cash (strict, indic.)</p>
          <p className="mt-2 font-mono text-2xl font-bold text-sky-100 sm:text-3xl">{money(snap.indicativeFreeCash)}</p>
          <p className="mt-1 text-xs leading-snug text-sky-200/75">
            max(0, liquid − COGS pool − supplier AP). CashPlan reserve earmarks are applied in the row below — not a tax
            or legal definition.
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-violet-500/25 bg-violet-500/[0.08] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-200/95">CashPlan reserves (earmarked)</p>
          <p className="mt-2 font-mono text-2xl font-bold text-violet-100">{money(snap.cashPlanReservesTotal)}</p>
          <p className="mt-1 text-xs text-violet-200/75">
            Money you have labeled for future obligations inside CashPlan. Physically it may still sit in the same till or
            bank account; here it is treated as spoken for.
          </p>
        </div>
        <div className="rounded-xl border border-teal-500/25 bg-teal-500/[0.08] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-200/95">Spendable after reserves (indic.)</p>
          <p className="mt-2 font-mono text-2xl font-bold text-teal-100">{money(snap.indicativeSpendableAfterCashPlanReserves)}</p>
          <p className="mt-1 text-xs text-teal-200/75">
            max(0, true free cash − CashPlan reserves). What is left after COGS, supplier AP, and your own discipline
            buckets.
          </p>
        </div>
      </div>

      <p className="mt-4 text-xs text-neutral-500">
        Receivables ({money(snap.debtorReceivablesTotal)}) and laybye ({money(snap.laybyeGoodsValue)}) are unchanged in the
        cards below; they affect cash when collected, not in these indicative formulas.
      </p>
    </section>
  );
}
