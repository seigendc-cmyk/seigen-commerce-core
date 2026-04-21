"use client";

import { useCallback, useId, useRef, useState } from "react";
import {
  BANK_SERVICE_PROVIDER_OPTIONS,
  emptyVendorBankAccount,
  labelForBankProvider,
  type BankConnectionStatus,
  type BankServiceProvider,
  type VendorBankAccount,
} from "@/modules/dashboard/settings/banks/bank-types";

const STATUS_LABELS: Record<BankConnectionStatus, string> = {
  draft: "Draft",
  pending: "Pending",
  connected: "Connected",
  error: "Error",
  disconnected: "Disconnected",
};

function rowSummary(a: VendorBankAccount, index: number): string {
  const label = a.accountLabel.trim() || a.institutionName.trim();
  const prov = labelForBankProvider(a.serviceProvider);
  if (label.length > 0) return `${prov} · ${label}`;
  return `${prov} · Account ${index + 1}`;
}

export function BanksSettingsForm() {
  const listId = useId();
  const nextSeq = useRef(1);

  const [accounts, setAccounts] = useState<VendorBankAccount[]>(() => [emptyVendorBankAccount(`${listId}-a0`)]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savedHint, setSavedHint] = useState<string | null>(null);

  const updateAccount = useCallback((id: string, patch: Partial<VendorBankAccount>) => {
    setAccounts((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const addAccount = useCallback(() => {
    const id = `${listId}-a${nextSeq.current++}`;
    setAccounts((rows) => [...rows, emptyVendorBankAccount(id)]);
    setExpandedId(id);
  }, [listId]);

  const removeAccount = useCallback((id: string) => {
    setAccounts((rows) => (rows.length <= 1 ? rows : rows.filter((r) => r.id !== id)));
    setExpandedId((cur) => (cur === id ? null : cur));
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavedHint(
      "Draft saved locally — live bank APIs, consent flows, and secure token storage connect when your workspace is wired.",
    );
    window.setTimeout(() => setSavedHint(null), 4000);
  }

  function placeholderConnect(id: string) {
    updateAccount(id, { connectionStatus: "pending", providerExternalRef: "demo-ref-pending" });
    window.setTimeout(() => {
      updateAccount(id, { connectionStatus: "connected", providerExternalRef: "demo-ref-connected" });
    }, 800);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="vendor-panel rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white">Banks &amp; service providers</h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-300">
          Create bank profiles and choose how each one connects—manual records, open banking, an aggregator feed, or
          card-settlement lines. When integrations are on, seiGEN will use these links for reconciliation, cash
          movement, and mapping into your chart of accounts.
        </p>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-white">Accounts</h2>
        <button
          type="button"
          onClick={addAccount}
          className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:border-teal-500 hover:text-teal-600"
        >
          Add bank account
        </button>
      </div>

      <div className="space-y-3">
        {accounts.map((a, index) => {
          const open = expandedId === a.id;
          return (
            <div
              key={a.id}
              className="overflow-hidden rounded-2xl border border-white/12 bg-white/[0.03] shadow-sm"
            >
              <button
                type="button"
                onClick={() => setExpandedId(open ? null : a.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.06]"
              >
                <span className="text-sm font-medium text-white">{rowSummary(a, index)}</span>
                <span className="shrink-0 text-xs text-neutral-400">
                  {STATUS_LABELS[a.connectionStatus]} · {open ? "Hide" : "Configure"}
                </span>
              </button>
              {open ? (
                <div className="space-y-4 border-t border-white/10 px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => removeAccount(a.id)}
                      disabled={accounts.length <= 1}
                      className="text-xs font-semibold text-red-300/90 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-200" htmlFor={`bk-prov-${a.id}`}>
                      Bank service provider
                    </label>
                    <select
                      id={`bk-prov-${a.id}`}
                      value={a.serviceProvider}
                      onChange={(e) => updateAccount(a.id, { serviceProvider: e.target.value as BankServiceProvider })}
                      className="vendor-field mt-1 w-full max-w-xl rounded-lg px-3 py-2 text-sm"
                    >
                      {BANK_SERVICE_PROVIDER_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-neutral-500">
                      {BANK_SERVICE_PROVIDER_OPTIONS.find((o) => o.id === a.serviceProvider)?.description}
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-neutral-200" htmlFor={`bk-inst-${a.id}`}>
                        Institution / bank name
                      </label>
                      <input
                        id={`bk-inst-${a.id}`}
                        value={a.institutionName}
                        onChange={(e) => updateAccount(a.id, { institutionName: e.target.value })}
                        className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                        placeholder="e.g. First National Bank"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-200" htmlFor={`bk-br-${a.id}`}>
                        Branch or product
                      </label>
                      <input
                        id={`bk-br-${a.id}`}
                        value={a.branchOrProduct}
                        onChange={(e) => updateAccount(a.id, { branchOrProduct: e.target.value })}
                        className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                        placeholder="Optional"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-neutral-200" htmlFor={`bk-lab-${a.id}`}>
                        Account label (in seiGEN)
                      </label>
                      <input
                        id={`bk-lab-${a.id}`}
                        value={a.accountLabel}
                        onChange={(e) => updateAccount(a.id, { accountLabel: e.target.value })}
                        className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                        placeholder="e.g. Operating · USD"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-200" htmlFor={`bk-mask-${a.id}`}>
                        Account identifier (masked)
                      </label>
                      <input
                        id={`bk-mask-${a.id}`}
                        value={a.accountIdentifierMasked}
                        onChange={(e) => updateAccount(a.id, { accountIdentifierMasked: e.target.value })}
                        className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                        placeholder="e.g. ···· 4521"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-neutral-200" htmlFor={`bk-ccy-${a.id}`}>
                        Currency
                      </label>
                      <input
                        id={`bk-ccy-${a.id}`}
                        value={a.currency}
                        onChange={(e) => updateAccount(a.id, { currency: e.target.value.toUpperCase().slice(0, 3) })}
                        className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm font-mono"
                        placeholder="USD"
                        maxLength={3}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-200" htmlFor={`bk-st-${a.id}`}>
                        Connection status
                      </label>
                      <select
                        id={`bk-st-${a.id}`}
                        value={a.connectionStatus}
                        onChange={(e) =>
                          updateAccount(a.id, { connectionStatus: e.target.value as BankConnectionStatus })
                        }
                        className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                      >
                        {(Object.keys(STATUS_LABELS) as BankConnectionStatus[]).map((k) => (
                          <option key={k} value={k}>
                            {STATUS_LABELS[k]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-200" htmlFor={`bk-ext-${a.id}`}>
                      Provider reference (when connected)
                    </label>
                    <input
                      id={`bk-ext-${a.id}`}
                      value={a.providerExternalRef}
                      onChange={(e) => updateAccount(a.id, { providerExternalRef: e.target.value })}
                      className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm font-mono text-xs"
                      placeholder="Populated by OAuth / feed — not secrets in the browser"
                    />
                  </div>

                  {a.serviceProvider !== "manual_entry" ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => placeholderConnect(a.id)}
                        className="rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15"
                      >
                        Simulate connect
                      </button>
                      <span className="text-xs text-neutral-500">
                        Replaced by real consent and token exchange when your banking integration is live.
                      </span>
                    </div>
                  ) : null}

                  <div>
                    <label className="block text-sm font-medium text-neutral-200" htmlFor={`bk-notes-${a.id}`}>
                      Notes
                    </label>
                    <textarea
                      id={`bk-notes-${a.id}`}
                      value={a.notes}
                      onChange={(e) => updateAccount(a.id, { notes: e.target.value })}
                      rows={3}
                      className="vendor-field mt-1 w-full resize-y rounded-lg px-3 py-2 text-sm"
                      placeholder="Reconciliation cadence, signatories, or mapping hints to COA."
                    />
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="vendor-panel-soft rounded-2xl px-5 py-4 text-sm text-neutral-300">
        <p className="font-medium text-white">Chart of accounts &amp; cashbooks</p>
        <p className="mt-1 text-neutral-400">
          Each bank account should eventually map to a balance-sheet account in your COA. Cashbook and POS settlement
          postings will use those links so the general ledger stays aligned with bank reality.
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
