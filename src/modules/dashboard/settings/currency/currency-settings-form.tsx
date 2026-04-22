"use client";

import { useMemo, useState } from "react";
import {
  labelForCurrencyCode,
  TRANSACTION_CURRENCY_OPTIONS,
} from "@/modules/dashboard/settings/currency/currency-options";
import { readCurrencySettings, writeCurrencySettings } from "@/modules/financial/services/currency-settings";

export function CurrencySettingsForm() {
  const [query, setQuery] = useState("");
  const [enabledCodes, setEnabledCodes] = useState<string[]>(() => readCurrencySettings().enabledCodes.slice());
  const [baseCurrency, setBaseCurrency] = useState<string>(() => readCurrencySettings().baseCurrency);
  const [reportingCurrency, setReportingCurrency] = useState<string>(() => readCurrencySettings().reportingCurrency);
  const [savedHint, setSavedHint] = useState<string | null>(null);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TRANSACTION_CURRENCY_OPTIONS;
    return TRANSACTION_CURRENCY_OPTIONS.filter(
      (c) => c.code.toLowerCase().includes(q) || c.label.toLowerCase().includes(q),
    );
  }, [query]);

  const enabledSet = useMemo(() => new Set(enabledCodes), [enabledCodes]);

  function syncBaseReporting(nextEnabled: string[]) {
    const pick = (current: string) => (nextEnabled.includes(current) ? current : nextEnabled[0] ?? "USD");
    setBaseCurrency((b) => pick(b));
    setReportingCurrency((r) => pick(r));
  }

  function toggleCurrency(code: string) {
    setEnabledCodes((prev) => {
      const on = prev.includes(code);
      if (on && prev.length <= 1) {
        return prev;
      }
      const next = on ? prev.filter((c) => c !== code) : [...prev, code].sort((a, b) => a.localeCompare(b));
      syncBaseReporting(next);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    writeCurrencySettings({ enabledCodes, baseCurrency, reportingCurrency });
    setSavedHint(
      "Saved locally — FX rates and server persistence connect when your ledger API is wired.",
    );
    window.setTimeout(() => setSavedHint(null), 4000);
  }

  const selectOptions = enabledCodes.map((code) => ({
    code,
    label: `${code} — ${labelForCurrencyCode(code)}`,
  }));

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="vendor-panel rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white">Base &amp; reporting</h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-300">
          Choose which of your <span className="text-neutral-100">enabled</span> currencies is the primary book
          currency (base) and which currency consolidated reports should use. They can be the same or different—for
          example, base in your operating currency and reporting in the group&apos;s standard.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-neutral-200" htmlFor="currency-base">
              Base currency
            </label>
            <select
              id="currency-base"
              value={baseCurrency}
              onChange={(e) => setBaseCurrency(e.target.value)}
              className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
            >
              {selectOptions.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-neutral-500">Primary currency for balances, inventory valuation, and tax.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-200" htmlFor="currency-reporting">
              Reporting currency
            </label>
            <select
              id="currency-reporting"
              value={reportingCurrency}
              onChange={(e) => setReportingCurrency(e.target.value)}
              className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
            >
              {selectOptions.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-neutral-500">Roll-ups, dashboards, and exports can target this currency.</p>
          </div>
        </div>
      </section>

      <section className="vendor-panel rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white">Transaction currencies</h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-300">
          Enable every currency your tills, invoices, and refunds may use. Staff can switch among them at transaction
          time where your plan allows; amounts convert using rates you maintain or import later.
        </p>
        <p className="mt-2 text-xs text-neutral-500">
          At least one currency must stay enabled. Base and reporting must always be chosen from this list.
        </p>

        <label className="mt-4 block text-sm font-medium text-neutral-200" htmlFor="currency-search">
          Search currencies
        </label>
        <input
          id="currency-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Code or name, e.g. EUR or euro"
          className="vendor-field mt-1 w-full max-w-md rounded-lg px-3 py-2 text-sm"
        />

        <ul className="mt-4 grid max-h-[min(420px,50vh)] gap-2 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-3 sm:grid-cols-2">
          {filteredOptions.map((c) => {
            const checked = enabledSet.has(c.code);
            const sole = checked && enabledCodes.length === 1;
            return (
              <li key={c.code}>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 hover:border-white/20">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-teal-600"
                    checked={checked}
                    disabled={sole}
                    onChange={() => toggleCurrency(c.code)}
                  />
                  <span className="text-sm">
                    <span className="font-mono font-semibold text-white">{c.code}</span>
                    <span className="ml-2 text-neutral-300">{c.label}</span>
                    {sole ? (
                      <span className="mt-0.5 block text-[11px] text-neutral-500">Cannot remove the last currency.</span>
                    ) : null}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="vendor-panel-soft rounded-2xl px-5 py-4 text-sm text-neutral-300">
        <p className="font-medium text-white">Interchangeable use in transactions</p>
        <p className="mt-1 text-neutral-400">
          POS and order flows will offer the enabled set so cashiers and clerks can post in the customer&apos;s
          currency without changing company settings. Conversion to base for stock and settlement uses the rate table
          when connected.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-95"
        >
          Save draft
        </button>
        {savedHint ? <p className="text-sm text-neutral-400">{savedHint}</p> : null}
      </div>
    </form>
  );
}
