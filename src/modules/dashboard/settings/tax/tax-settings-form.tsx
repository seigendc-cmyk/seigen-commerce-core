"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FINANCIAL_LEDGERS_UPDATED_EVENT } from "@/modules/financial/services/financial-events";
import {
  listTaxLedgerEntries,
  taxLedgerStorageKey,
  totalInputTax,
  totalOutputTax,
} from "@/modules/financial/services/tax-ledger";
import {
  DEFAULT_TAX_ON_SALES_SETTINGS,
  readTaxOnSalesSettings,
  taxOnSalesSettingsStorageKey,
  writeTaxOnSalesSettings,
  type TaxOnSalesSettings,
} from "@/modules/financial/services/tax-settings";

function money(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function TaxSettingsForm() {
  const [tick, setTick] = useState(0);
  const [draft, setDraft] = useState<TaxOnSalesSettings>(() => readTaxOnSalesSettings());
  const [saved, setSaved] = useState<string | null>(null);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const onFin = () => refresh();
    window.addEventListener(FINANCIAL_LEDGERS_UPDATED_EVENT, onFin);
    return () => window.removeEventListener(FINANCIAL_LEDGERS_UPDATED_EVENT, onFin);
  }, [refresh]);

  const ledger = useMemo(() => {
    void tick;
    return listTaxLedgerEntries(400);
  }, [tick]);

  const outTot = useMemo(() => {
    void tick;
    return totalOutputTax();
  }, [tick]);

  const inTot = useMemo(() => {
    void tick;
    return totalInputTax();
  }, [tick]);

  function save(e: React.FormEvent) {
    e.preventDefault();
    const next = writeTaxOnSalesSettings(draft);
    setDraft(next);
    setSaved("Saved.");
    window.setTimeout(() => setSaved(null), 3000);
    refresh();
  }

  function resetDefaults() {
    setDraft({ ...DEFAULT_TAX_ON_SALES_SETTINGS });
  }

  return (
    <div className="space-y-8">
      <form onSubmit={save} className="vendor-panel-soft space-y-6 rounded-2xl p-6">
        <div>
          <h2 className="text-base font-semibold text-white">Tax on sales & purchases</h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-300">
            When enabled, POS collects <span className="text-neutral-100">output tax</span> on taxable catalog lines
            (respecting each product&apos;s taxable flag). Purchase orders accrue <span className="text-neutral-100">input tax</span>{" "}
            on taxable items when you mark a PO ordered. Amounts post to the tax ledger below (local-first).
          </p>
          <p className="mt-2 text-xs text-neutral-500 font-mono">
            Settings key: <span className="text-neutral-400">{taxOnSalesSettingsStorageKey()}</span>
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={draft.enabled}
            onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
          />
          <span>
            <span className="text-sm font-medium text-white">Enable tax on sales & purchase postings</span>
            <span className="mt-1 block text-xs text-neutral-500">
              Turn off to stop calculating tax until you are ready; existing ledger rows remain.
            </span>
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-neutral-300">Tax label</span>
            <input
              className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
              value={draft.taxLabel}
              onChange={(e) => setDraft((d) => ({ ...d, taxLabel: e.target.value }))}
              placeholder="VAT, GST, Sales tax…"
            />
          </label>
          <label className="block text-sm">
            <span className="text-neutral-300">Rate (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              step="any"
              className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
              value={draft.ratePercent}
              onChange={(e) => setDraft((d) => ({ ...d, ratePercent: Number(e.target.value) }))}
            />
          </label>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-white">Tax collector (authority)</h3>
          <p className="mt-1 text-xs text-neutral-500">
            Use for receipts, filings, and support — the body that receives or administers this tax (e.g. national or
            regional revenue service).
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="text-neutral-300">Collector name</span>
              <input
                className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                value={draft.taxCollectorName}
                onChange={(e) => setDraft((d) => ({ ...d, taxCollectorName: e.target.value }))}
                placeholder="e.g. South African Revenue Service"
                autoComplete="organization"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-neutral-300">Collector contact details</span>
              <textarea
                className="vendor-field mt-1 min-h-[88px] w-full resize-y rounded-lg px-3 py-2 text-sm"
                value={draft.taxCollectorContact}
                onChange={(e) => setDraft((d) => ({ ...d, taxCollectorContact: e.target.value }))}
                placeholder="Call centre, website, email, postal address, or taxpayer reference format…"
                rows={3}
              />
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-white">Your tax contact person</h3>
          <p className="mt-1 text-xs text-neutral-500">
            Who auditors or staff should reach for tax questions at your business (may differ from the collector above).
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="text-neutral-300">Contact person name</span>
              <input
                className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                value={draft.taxContactPersonName}
                onChange={(e) => setDraft((d) => ({ ...d, taxContactPersonName: e.target.value }))}
                placeholder="Full name"
                autoComplete="name"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-neutral-300">Contact person details</span>
              <textarea
                className="vendor-field mt-1 min-h-[88px] w-full resize-y rounded-lg px-3 py-2 text-sm"
                value={draft.taxContactPersonContact}
                onChange={(e) => setDraft((d) => ({ ...d, taxContactPersonContact: e.target.value }))}
                placeholder="Phone, email, role or department, extension…"
                rows={3}
              />
            </label>
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={draft.pricesTaxInclusive}
            onChange={(e) => setDraft((d) => ({ ...d, pricesTaxInclusive: e.target.checked }))}
          />
          <span>
            <span className="text-sm font-medium text-white">POS shelf prices include tax</span>
            <span className="mt-1 block text-xs text-neutral-500">
              Tax is extracted from line totals (typical retail). If unchecked, tax is added on top of goods + delivery
              (when delivery is taxed).
            </span>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={draft.purchaseCostsTaxInclusive}
            onChange={(e) => setDraft((d) => ({ ...d, purchaseCostsTaxInclusive: e.target.checked }))}
          />
          <span>
            <span className="text-sm font-medium text-white">PO unit costs include input tax</span>
            <span className="mt-1 block text-xs text-neutral-500">
              When checked, VAT is extracted from the taxable PO line total. When unchecked, input tax is calculated on
              top of exclusive costs.
            </span>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={draft.applyTaxToDelivery}
            onChange={(e) => setDraft((d) => ({ ...d, applyTaxToDelivery: e.target.checked }))}
          />
          <span>
            <span className="text-sm font-medium text-white">Apply rate to iDeliver delivery fee</span>
            <span className="mt-1 block text-xs text-neutral-500">
              Uses the same inclusive / exclusive rules as goods.
            </span>
          </span>
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className="rounded-lg bg-brand-orange px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-orange-hover"
          >
            Save
          </button>
          <button
            type="button"
            onClick={resetDefaults}
            className="rounded-lg border border-white/20 px-4 py-2.5 text-sm font-semibold text-white hover:border-brand-orange"
          >
            Reset defaults
          </button>
          {saved ? <span className="self-center text-sm text-emerald-300">{saved}</span> : null}
        </div>
      </form>

      <section className="vendor-panel-soft rounded-2xl p-6">
        <h3 className="text-base font-semibold text-white">Links</h3>
        <p className="mt-2 text-sm text-neutral-400">
          POS uses these rules at tender. Inventory products can be marked non-taxable per line. Purchasing posts input
          tax when a PO is marked ordered.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/dashboard/pos"
            className="inline-flex rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:border-brand-orange"
          >
            Open POS →
          </Link>
          <Link
            href="/dashboard/inventory/purchasing"
            className="inline-flex rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:border-brand-orange"
          >
            Purchasing →
          </Link>
        </div>
      </section>

      <section className="vendor-panel-soft rounded-2xl p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h3 className="text-base font-semibold text-white">Tax ledger (output & input)</h3>
          <div className="text-right text-xs text-neutral-400">
            <p>
              Output total: <span className="font-mono text-neutral-200">{money(outTot)}</span>
            </p>
            <p>
              Input total: <span className="font-mono text-neutral-200">{money(inTot)}</span>
            </p>
            <p className="mt-1 font-mono text-[10px] text-neutral-500">{taxLedgerStorageKey()}</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          <span className="text-rose-200/90">Output</span> = tax on retail sales.{" "}
          <span className="text-emerald-200/90">Input</span> = recoverable tax on taxable purchase lines when a PO is
          ordered.
        </p>
        <div className="mt-4 max-h-[min(420px,55vh)] overflow-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="sticky top-0 border-b border-white/10 bg-white/[0.04] text-xs font-semibold uppercase tracking-wide text-neutral-400">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2 text-right">Tax amt</th>
                <th className="px-3 py-2 text-right">Net base</th>
                <th className="px-3 py-2">Rate</th>
                <th className="px-3 py-2">Memo</th>
              </tr>
            </thead>
            <tbody>
              {ledger.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-neutral-500">
                    No tax postings yet. Enable tax above and complete a sale or mark a PO ordered.
                  </td>
                </tr>
              ) : (
                ledger.map((e) => (
                  <tr key={e.id} className="border-b border-white/[0.06] last:border-0">
                    <td className="px-3 py-2.5 whitespace-nowrap text-neutral-400">
                      {new Date(e.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                    </td>
                    <td
                      className={
                        e.direction === "output"
                          ? "px-3 py-2.5 font-semibold text-rose-200/95"
                          : "px-3 py-2.5 font-semibold text-emerald-200/95"
                      }
                    >
                      {e.direction === "output" ? "Output" : "Input"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-white">{money(e.amount)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-neutral-300">{money(e.taxableBase)}</td>
                    <td className="px-3 py-2.5 text-neutral-400">{e.taxRatePercent}%</td>
                    <td className="px-3 py-2.5 text-neutral-300">{e.memo}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
