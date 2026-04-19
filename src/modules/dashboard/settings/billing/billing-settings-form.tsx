"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PLANS } from "@/lib/plans";
import {
  acceptPendingBillingFeature,
  declinePendingBillingFeature,
  loadBillingDashboard,
  redeemBillingActivationCode,
} from "./billing-actions";
import type { BillingDashboardPayload, VendorInvoiceRow } from "./billing-types";

function formatMoney(cents: number, currency: string) {
  const n = cents / 100;
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(n);
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
  } catch {
    return iso;
  }
}

export function BillingSettingsForm() {
  const [data, setData] = useState<BillingDashboardPayload | null>(null);
  const [unavailable, setUnavailable] = useState<{ message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalInvoice, setModalInvoice] = useState<VendorInvoiceRow | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setActionError(null);
    const res = await loadBillingDashboard();
    setLoading(false);
    if (res.ok) {
      setData(res);
      setUnavailable(null);
    } else {
      setData(null);
      setUnavailable({ message: res.message });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onAccept(id: string) {
    setBusy(true);
    setActionError(null);
    const r = await acceptPendingBillingFeature(id);
    setBusy(false);
    if (!r.ok) setActionError(r.error);
    else void refresh();
  }

  async function onDecline(id: string) {
    setBusy(true);
    setActionError(null);
    const r = await declinePendingBillingFeature(id);
    setBusy(false);
    if (!r.ok) setActionError(r.error);
    else void refresh();
  }

  async function onRedeem(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setActionError(null);
    const r = await redeemBillingActivationCode(codeInput);
    setBusy(false);
    if (!r.ok) setActionError(r.error);
    else {
      setCodeInput("");
      void refresh();
      setModalInvoice(null);
    }
  }

  if (loading && !data && !unavailable) {
    return (
      <div className="vendor-panel-soft rounded-2xl p-8 text-sm text-neutral-400">Loading billing…</div>
    );
  }

  if (unavailable && !data) {
    return (
      <div className="space-y-6">
        <section className="vendor-panel-soft rounded-2xl p-6">
          <h2 className="text-base font-semibold text-white">Billing</h2>
          <p className="mt-2 text-sm text-amber-100/90">{unavailable.message}</p>
          <p className="mt-3 text-sm text-neutral-400">
            Commercial plans below mirror the public catalog. Connect Supabase and run the billing migration to sync
            prices from the database and use invoices, pending charges, and activation codes.
          </p>
        </section>
        <section className="vendor-panel-soft rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-white">Reference plans</h3>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PLANS.map((p) => (
              <li key={p.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="font-medium text-white">{p.name}</p>
                <p className="mt-1 text-lg font-semibold text-brand-orange">{p.monthlyPriceLabel}/mo</p>
                <p className="mt-2 text-xs text-neutral-500">{p.purpose}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-neutral-500">
            Change plan from the{" "}
            <Link href="/plans" className="text-brand-orange hover:underline">
              Plans
            </Link>{" "}
            page after sign-in.
          </p>
        </section>
      </div>
    );
  }

  if (!data?.ok) return null;

  const linesForModal = modalInvoice ? data.linesByInvoiceId[modalInvoice.id] ?? [] : [];

  return (
    <div className="space-y-6">
      {actionError ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {actionError}
        </div>
      ) : null}

      <section className="vendor-panel-soft rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Plans &amp; pricing</h2>
            <p className="mt-1 text-sm text-neutral-400">
              Monthly amounts are stored in Supabase (<code className="rounded bg-neutral-800 px-1 text-xs">billing_plan_catalog</code>
              ). Marketing copy merges with your live prices.
            </p>
          </div>
          <Link
            href="/plans"
            className="shrink-0 rounded-lg border border-white/20 px-3 py-2 text-sm font-medium text-white hover:border-brand-orange hover:text-brand-orange"
          >
            View upgrade options
          </Link>
        </div>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.plans.map((p) => (
            <li
              key={p.planId}
              className={
                p.isCurrent
                  ? "rounded-xl border border-brand-orange/50 bg-brand-orange/10 p-4"
                  : "rounded-xl border border-white/10 bg-white/[0.03] p-4"
              }
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-white">{p.displayName}</p>
                {p.isCurrent ? (
                  <span className="rounded-full bg-brand-orange/20 px-2 py-0.5 text-xs font-medium text-brand-orange">
                    Current
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-xl font-semibold text-neutral-100">
                {formatMoney(p.monthlyAmountCents, p.currency)}
                <span className="text-sm font-normal text-neutral-500">/mo</span>
              </p>
              <p className="mt-2 text-xs text-neutral-500">{p.tagline}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="vendor-panel-soft rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white">Billable add-ons</h2>
        <p className="mt-1 text-sm text-neutral-400">
          Replace or extend rows in <code className="rounded bg-neutral-800 px-1 text-xs">billable_features</code> when you
          finalize modules and pricing. Offered charges require acceptance before they appear on an invoice.
        </p>
        {data.billableCatalog.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-500">No active billable features in the database yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-white/10 rounded-xl border border-white/10">
            {data.billableCatalog.map((f) => (
              <li key={f.feature_key} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-neutral-200">{f.label}</p>
                  {f.description ? <p className="text-xs text-neutral-500">{f.description}</p> : null}
                  <p className="text-xs text-neutral-600">
                    {f.billing_kind === "recurring_monthly" ? "Recurring monthly" : "One-time"} · {f.feature_key}
                  </p>
                </div>
                <span className="font-medium text-white">{formatMoney(f.amount_cents, "USD")}</span>
              </li>
            ))}
          </ul>
        )}
        {data.paidAddonKeys.length > 0 ? (
          <p className="mt-4 text-xs text-neutral-500">
            Active paid add-ons for your workspace: {data.paidAddonKeys.join(", ")}
          </p>
        ) : (
          <p className="mt-4 text-xs text-neutral-600">No paid add-on modules activated yet (requires paid invoice).</p>
        )}
      </section>

      <section className="vendor-panel-soft rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white">Pending charges</h2>
        <p className="mt-2 text-sm text-neutral-400">
          When a new feature is added to your subscription, it appears here. Accept to add the amount to your bill.
          Decline to skip. <strong className="text-neutral-300">Unpaid features stay off</strong> until the invoice is paid
          with an activation code.
        </p>
        {data.pending.filter((x) => x.status === "pending").length === 0 ? (
          <p className="mt-4 text-sm text-neutral-500">No pending charges.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {data.pending
              .filter((x) => x.status === "pending")
              .map((p) => (
                <li
                  key={p.id}
                  className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-white">{p.label}</p>
                    <p className="text-sm text-neutral-400">
                      {formatMoney(p.amount_cents, "USD")} · {p.feature_key}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void onDecline(p.id)}
                      className="rounded-lg border border-white/20 px-3 py-2 text-sm text-neutral-200 hover:bg-white/5 disabled:opacity-50"
                    >
                      Decline
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void onAccept(p.id)}
                      className="rounded-lg bg-brand-orange px-3 py-2 text-sm font-medium text-white hover:bg-brand-orange-hover disabled:opacity-50"
                    >
                      Accept &amp; add to bill
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </section>

      <section className="vendor-panel-soft rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white">Invoices</h2>
        <p className="mt-1 text-sm text-neutral-400">
          Signup creates an initial subscription invoice. Feature add-ons append to your open invoice. Click a row for line
          items and cycle dates.
        </p>
        {data.invoices.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-500">No invoices yet. They appear after workspace provisioning.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase text-neutral-500">
                  <th className="pb-2 pr-4 font-medium">Created</th>
                  <th className="pb-2 pr-4 font-medium">Period</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Total</th>
                  <th className="pb-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {data.invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-white/5">
                    <td className="py-3 pr-4 text-neutral-300">{formatDate(inv.created_at)}</td>
                    <td className="py-3 pr-4 text-neutral-400">
                      {formatDate(inv.cycle_start)} → {formatDate(inv.cycle_end)}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={
                          inv.status === "paid"
                            ? "text-emerald-400"
                            : inv.status === "open"
                              ? "text-amber-200"
                              : "text-neutral-500"
                        }
                      >
                        {inv.status}
                      </span>
                      {inv.paid_at ? (
                        <span className="ml-2 text-xs text-neutral-500">Paid {formatDate(inv.paid_at)}</span>
                      ) : null}
                    </td>
                    <td className="py-3 pr-4 font-medium text-white">{formatMoney(inv.total_cents, inv.currency)}</td>
                    <td className="py-3">
                      <button
                        type="button"
                        onClick={() => setModalInvoice(inv)}
                        className="text-sm font-medium text-brand-orange hover:underline"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="vendor-panel-soft rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white">Pay with activation code</h2>
        <p className="mt-2 text-sm text-neutral-400">
          Operations issues a code linked to your open invoice. Enter it here to mark the bill paid and{" "}
          <strong className="text-neutral-300">activate</strong> any feature add-on lines on that invoice. Codes are stored
          in <code className="rounded bg-neutral-800 px-1 text-xs">activation_codes</code>.
        </p>
        <form onSubmit={onRedeem} className="mt-4 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="activation-code" className="block text-xs font-medium text-neutral-400">
              Activation code
            </label>
            <input
              id="activation-code"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              autoComplete="off"
              placeholder="e.g. SEIGEN-XXXX-XXXX"
              className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={busy || !codeInput.trim()}
            className="rounded-lg bg-white/10 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-50"
          >
            Apply code
          </button>
        </form>
      </section>

      {modalInvoice ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="invoice-modal-title"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close"
            onClick={() => setModalInvoice(null)}
          />
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-white/15 bg-neutral-950 p-6 shadow-xl">
            <h3 id="invoice-modal-title" className="text-lg font-semibold text-white">
              Invoice details
            </h3>
            <p className="mt-1 text-xs text-neutral-500">
              {formatDate(modalInvoice.created_at)} · {modalInvoice.status.toUpperCase()}
            </p>
            <p className="mt-3 text-sm text-neutral-400">
              Subscription cycle: {formatDate(modalInvoice.cycle_start)} — {formatDate(modalInvoice.cycle_end)}
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              Amount due for this cycle reflects accepted line items. Pay via activation code to activate add-ons.
            </p>
            <ul className="mt-4 space-y-2 border-t border-white/10 pt-4">
              {linesForModal.length === 0 ? (
                <li className="text-sm text-neutral-500">No line items.</li>
              ) : (
                linesForModal.map((ln) => (
                  <li key={ln.id} className="flex justify-between gap-4 text-sm">
                    <span className="text-neutral-200">{ln.description}</span>
                    <span className="shrink-0 font-medium text-white">{formatMoney(ln.amount_cents, modalInvoice.currency)}</span>
                  </li>
                ))
              )}
            </ul>
            <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4 text-base font-semibold text-white">
              <span>Total</span>
              <span>{formatMoney(modalInvoice.total_cents, modalInvoice.currency)}</span>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalInvoice(null)}
                className="rounded-lg border border-white/20 px-4 py-2 text-sm text-neutral-200 hover:bg-white/5"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
