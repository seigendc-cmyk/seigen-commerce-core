"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  enrichCreditorEntriesForAgeing,
  sumByDueBucket,
  type DueBucketLabel,
} from "@/modules/financial/lib/creditor-ageing";
import { FINANCIAL_LEDGERS_UPDATED_EVENT } from "@/modules/financial/services/financial-events";
import { balanceBySupplierId, listCreditorEntriesForSupplier } from "@/modules/financial/services/creditors-ledger";
import type { Id, Supplier, SupplierContactPerson } from "@/modules/inventory/types/models";
import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";

function money(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function newContactId(): string {
  return `ct_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

type Props = {
  suppliers: Supplier[];
  onRefresh: () => void;
};

export function SupplierProfilePanel({ suppliers, onRefresh }: Props) {
  const [selectedId, setSelectedId] = useState<Id | null>(null);
  const [query, setQuery] = useState("");
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [financialTick, setFinancialTick] = useState(0);

  const refreshFinancial = useCallback(() => setFinancialTick((t) => t + 1), []);

  useEffect(() => {
    window.addEventListener(FINANCIAL_LEDGERS_UPDATED_EVENT, refreshFinancial);
    return () => window.removeEventListener(FINANCIAL_LEDGERS_UPDATED_EVENT, refreshFinancial);
  }, [refreshFinancial]);

  const balances = useMemo(() => {
    void financialTick;
    return balanceBySupplierId();
  }, [financialTick]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.accountNumber?.toLowerCase().includes(q) ?? false) ||
        (s.city?.toLowerCase().includes(q) ?? false),
    );
  }, [suppliers, query]);

  const selected = selectedId ? InventoryRepo.getSupplier(selectedId) : undefined;

  const apBalance = selectedId ? balances.get(selectedId) ?? 0 : 0;

  const ledgerRows = useMemo(() => {
    if (!selectedId) return [];
    void financialTick;
    return enrichCreditorEntriesForAgeing(listCreditorEntriesForSupplier(selectedId));
  }, [selectedId, financialTick]);

  const bucketTotals = useMemo(() => sumByDueBucket(ledgerRows), [ledgerRows]);

  const [draft, setDraft] = useState<Partial<Supplier> | null>(null);

  /** Sync draft only when the selected supplier id changes — not when `getSupplier()` returns a new object reference each render (that caused infinite setState loops). */
  useEffect(() => {
    if (!selectedId) {
      setDraft(null);
      return;
    }
    const s = InventoryRepo.getSupplier(selectedId);
    if (!s) {
      setDraft(null);
      return;
    }
    setDraft({
      ...s,
      contactPersons: s.contactPersons?.length ? s.contactPersons.map((c) => ({ ...c })) : [],
    });
  }, [selectedId]);

  function saveProfile() {
    if (!selectedId || !draft) return;
    const persons = draft.contactPersons?.filter((c) => c.name.trim());
    InventoryRepo.updateSupplier(selectedId, {
      name: draft.name?.trim() || "Unnamed supplier",
      contactName: draft.contactName?.trim() || undefined,
      phone: draft.phone?.trim() || undefined,
      email: draft.email?.trim() || undefined,
      address: draft.address?.trim() || undefined,
      addressLine1: draft.addressLine1?.trim() || undefined,
      addressLine2: draft.addressLine2?.trim() || undefined,
      city: draft.city?.trim() || undefined,
      region: draft.region?.trim() || undefined,
      postalCode: draft.postalCode?.trim() || undefined,
      country: draft.country?.trim() || undefined,
      accountNumber: draft.accountNumber?.trim() || undefined,
      businessTerms: draft.businessTerms?.trim() || undefined,
      paymentTermsDays:
        draft.paymentTermsDays != null && Number.isFinite(draft.paymentTermsDays)
          ? Math.min(365, Math.floor(Number(draft.paymentTermsDays)))
          : undefined,
      taxId: draft.taxId?.trim() || undefined,
      contactPersons: persons && persons.length > 0 ? persons : undefined,
    });
    onRefresh();
  }

  function printCreditorLedger() {
    if (!selected) return;
    const asOf = new Date().toLocaleDateString(undefined, { dateStyle: "long" });
    const rowsHtml = ledgerRows
      .map(
        (r) => `<tr>
        <td>${escapeHtml(r.poReference)}</td>
        <td>${fmtDate(r.invoiceDate)}</td>
        <td>${fmtDate(r.dueDate)}</td>
        <td style="text-align:right">${money(r.amount)}</td>
        <td>${r.daysPastDue <= 0 ? `Due in ${Math.abs(r.daysPastDue)}d` : `${r.daysPastDue}d past due`}</td>
        <td>${escapeHtml(r.dueBucket)}</td>
        <td>${escapeHtml(r.invoiceAgeBucket)}</td>
      </tr>`,
      )
      .join("");

    const bucketRows = (Object.keys(bucketTotals) as DueBucketLabel[])
      .map((k) => `<tr><td colspan="4"><strong>${escapeHtml(k)}</strong></td><td colspan="3" style="text-align:right"><strong>${money(bucketTotals[k])}</strong></td></tr>`)
      .join("");

    const html = `
      <h1>Creditors ledger</h1>
      <p><strong>${escapeHtml(selected.name)}</strong></p>
      <p>Account: ${escapeHtml(selected.accountNumber ?? "—")} · As of ${escapeHtml(asOf)}</p>
      <p>Outstanding AP: <strong>${money(apBalance)}</strong></p>
      <table border="1" cellspacing="0" cellpadding="6" style="width:100%;border-collapse:collapse;margin-top:16px">
        <thead>
          <tr>
            <th>Document</th><th>Invoice date</th><th>Due date</th><th>Amount</th><th>Status</th><th>Due bucket</th><th>Invoice age</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="7">No open invoices.</td></tr>`}
        </tbody>
        <tfoot>
          ${bucketRows}
          <tr><td colspan="4"><strong>Total</strong></td><td colspan="3" style="text-align:right"><strong>${money(apBalance)}</strong></td></tr>
        </tfoot>
      </table>
      <p style="margin-top:24px;font-size:11px;color:#666">seiGEN Commerce — local creditors ledger (unpaid credit POs).</p>
    `;

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(
      `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Creditors — ${escapeHtml(selected.name)}</title>
      <style>body{font-family:system-ui,sans-serif;padding:24px;color:#111} h1{font-size:20px}</style></head><body>${html}</body></html>`,
    );
    w.document.close();
    w.focus();
    w.print();
  }

  function escapeHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function fmtDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
    } catch {
      return iso;
    }
  }

  function updateContact(i: number, patch: Partial<SupplierContactPerson>) {
    setDraft((d) => {
      if (!d) return d;
      const list = [...(d.contactPersons ?? [])];
      list[i] = { ...list[i]!, ...patch };
      return { ...d, contactPersons: list };
    });
  }

  function addContact() {
    setDraft((d) => {
      if (!d) return d;
      const list = [...(d.contactPersons ?? [])];
      list.push({ id: newContactId(), name: "", isPrimary: list.length === 0 });
      return { ...d, contactPersons: list };
    });
  }

  function removeContact(i: number) {
    setDraft((d) => {
      if (!d) return d;
      const list = (d.contactPersons ?? []).filter((_, j) => j !== i);
      return { ...d, contactPersons: list };
    });
  }

  const [quickName, setQuickName] = useState("");
  const [quickPhone, setQuickPhone] = useState("");

  return (
    <div className="vendor-panel relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.07] to-transparent p-0 shadow-lg">
      <div className="border-b border-white/10 bg-white/[0.04] px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-white">Suppliers</h2>
            <p className="mt-0.5 text-xs text-neutral-500">Directory, terms, contacts, and creditor balance</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, account, city…"
            className="vendor-field min-w-[200px] flex-1 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(220px,280px)_1fr]">
        <div className="border-b border-white/10 lg:border-b-0 lg:border-r">
          <div className="max-h-[420px] overflow-y-auto p-3">
            {filtered.length === 0 ? (
              <p className="px-2 py-6 text-sm text-neutral-500">No matches.</p>
            ) : (
              <ul className="space-y-1">
                {filtered.map((s) => {
                  const bal = balances.get(s.id) ?? 0;
                  const active = s.id === selectedId;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(s.id)}
                        className={[
                          "flex w-full flex-col rounded-xl border px-3 py-2.5 text-left transition-colors",
                          active
                            ? "border-brand-orange/50 bg-brand-orange/10"
                            : "border-transparent bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.06]",
                        ].join(" ")}
                      >
                        <span className="text-sm font-medium text-white">{s.name}</span>
                        <span className="mt-1 flex items-center justify-between gap-2 text-[11px] text-neutral-500">
                          <span className="truncate">{s.accountNumber ? `#${s.accountNumber}` : "No account #"}</span>
                          {bal > 0 ? (
                            <span className="shrink-0 rounded bg-rose-500/20 px-1.5 py-0.5 font-mono text-rose-200">
                              {money(bal)}
                            </span>
                          ) : (
                            <span className="text-neutral-600">—</span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-white/10 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Quick add</p>
            <div className="mt-2 space-y-2">
              <input
                value={quickName}
                onChange={(e) => setQuickName(e.target.value)}
                placeholder="Trading name"
                className="vendor-field w-full rounded-lg px-3 py-2 text-sm"
              />
              <input
                value={quickPhone}
                onChange={(e) => setQuickPhone(e.target.value)}
                placeholder="Phone (optional)"
                className="vendor-field w-full rounded-lg px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={!quickName.trim()}
                onClick={() => {
                  const sup = InventoryRepo.addSupplier({
                    name: quickName.trim(),
                    phone: quickPhone.trim() || undefined,
                  });
                  setQuickName("");
                  setQuickPhone("");
                  setSelectedId(sup.id);
                  onRefresh();
                }}
                className="w-full rounded-lg bg-brand-orange px-3 py-2 text-sm font-semibold text-white hover:bg-brand-orange-hover disabled:opacity-50"
              >
                Add supplier
              </button>
            </div>
          </div>
        </div>

        <div className="min-h-[320px] p-5">
          {!selected || !draft ? (
            <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-6 text-center">
              <p className="text-sm font-medium text-neutral-400">Select a supplier</p>
              <p className="mt-2 max-w-sm text-xs text-neutral-500">
                View account balance, full address, commercial terms, contacts, and print the creditors ledger with
                ageing.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">{draft.name}</h3>
                  <p className="mt-1 text-xs text-neutral-500">Supplier id · {selected.id}</p>
                </div>
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-200/90">AP balance</p>
                  <p className="mt-1 font-mono text-2xl font-bold text-white">{money(apBalance)}</p>
                  <p className="mt-1 text-[10px] text-neutral-500">Unpaid credit POs</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setLedgerOpen(true)}
                  className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:border-brand-orange hover:text-brand-orange"
                >
                  View creditors ledger
                </button>
                <button
                  type="button"
                  onClick={printCreditorLedger}
                  className="rounded-lg bg-brand-orange px-3 py-2 text-sm font-semibold text-white hover:bg-brand-orange-hover"
                >
                  Print ledger
                </button>
              </div>

              <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Company</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs text-neutral-500">
                    Legal / trading name
                    <input
                      className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                      value={draft.name ?? ""}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    />
                  </label>
                  <label className="block text-xs text-neutral-500">
                    Account number
                    <input
                      className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                      value={draft.accountNumber ?? ""}
                      onChange={(e) => setDraft({ ...draft, accountNumber: e.target.value })}
                      placeholder="Your ref for this vendor"
                    />
                  </label>
                  <label className="block text-xs text-neutral-500">
                    Tax / VAT ID
                    <input
                      className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                      value={draft.taxId ?? ""}
                      onChange={(e) => setDraft({ ...draft, taxId: e.target.value })}
                    />
                  </label>
                  <label className="block text-xs text-neutral-500">
                    Payment terms (net days)
                    <input
                      type="number"
                      min={0}
                      max={365}
                      className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                      value={draft.paymentTermsDays ?? ""}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          paymentTermsDays: e.target.value === "" ? undefined : Number(e.target.value),
                        })
                      }
                      placeholder="30"
                    />
                  </label>
                </div>
                <label className="block text-xs text-neutral-500">
                  Business terms
                  <textarea
                    className="vendor-field mt-1 min-h-[72px] w-full rounded-lg px-3 py-2 text-sm"
                    value={draft.businessTerms ?? ""}
                    onChange={(e) => setDraft({ ...draft, businessTerms: e.target.value })}
                    placeholder="Incoterms, rebates, minimum order, returns…"
                  />
                </label>
              </section>

              <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Address</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="sm:col-span-2 block text-xs text-neutral-500">
                    Line 1
                    <input
                      className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                      value={draft.addressLine1 ?? ""}
                      onChange={(e) => setDraft({ ...draft, addressLine1: e.target.value })}
                    />
                  </label>
                  <label className="sm:col-span-2 block text-xs text-neutral-500">
                    Line 2
                    <input
                      className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                      value={draft.addressLine2 ?? ""}
                      onChange={(e) => setDraft({ ...draft, addressLine2: e.target.value })}
                    />
                  </label>
                  <label className="block text-xs text-neutral-500">
                    City
                    <input
                      className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                      value={draft.city ?? ""}
                      onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                    />
                  </label>
                  <label className="block text-xs text-neutral-500">
                    Region / state
                    <input
                      className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                      value={draft.region ?? ""}
                      onChange={(e) => setDraft({ ...draft, region: e.target.value })}
                    />
                  </label>
                  <label className="block text-xs text-neutral-500">
                    Postal code
                    <input
                      className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                      value={draft.postalCode ?? ""}
                      onChange={(e) => setDraft({ ...draft, postalCode: e.target.value })}
                    />
                  </label>
                  <label className="block text-xs text-neutral-500">
                    Country
                    <input
                      className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                      value={draft.country ?? ""}
                      onChange={(e) => setDraft({ ...draft, country: e.target.value })}
                    />
                  </label>
                  <label className="sm:col-span-2 block text-xs text-neutral-500">
                    Legacy single-line address (optional)
                    <input
                      className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                      value={draft.address ?? ""}
                      onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                    />
                  </label>
                </div>
              </section>

              <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Contact persons</h4>
                  <button
                    type="button"
                    onClick={addContact}
                    className="text-xs font-semibold text-brand-orange hover:underline"
                  >
                    + Add person
                  </button>
                </div>
                {(draft.contactPersons ?? []).length === 0 ? (
                  <p className="text-sm text-neutral-500">No named contacts — add buyers, AP clerks, or logistics.</p>
                ) : (
                  <div className="space-y-3">
                    {(draft.contactPersons ?? []).map((c, i) => (
                      <div
                        key={c.id}
                        className="rounded-lg border border-white/10 bg-black/20 p-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <label className="min-w-[140px] flex-1 text-xs text-neutral-500">
                            Name
                            <input
                              className="vendor-field mt-1 w-full rounded-lg px-2 py-1.5 text-sm"
                              value={c.name}
                              onChange={(e) => updateContact(i, { name: e.target.value })}
                            />
                          </label>
                          <label className="flex items-center gap-2 pt-6 text-xs text-neutral-400">
                            <input
                              type="checkbox"
                              checked={c.isPrimary === true}
                              onChange={(e) => {
                                const on = e.target.checked;
                                setDraft((d) => {
                                  if (!d?.contactPersons) return d;
                                  const list = d.contactPersons.map((p, j) => ({
                                    ...p,
                                    isPrimary: on ? j === i : false,
                                  }));
                                  return { ...d, contactPersons: list };
                                });
                              }}
                              className="accent-brand-orange"
                            />
                            Primary
                          </label>
                        </div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-3">
                          <label className="text-xs text-neutral-500">
                            Role
                            <input
                              className="vendor-field mt-1 w-full rounded-lg px-2 py-1.5 text-sm"
                              value={c.role ?? ""}
                              onChange={(e) => updateContact(i, { role: e.target.value })}
                              placeholder="Buyer, AP…"
                            />
                          </label>
                          <label className="text-xs text-neutral-500">
                            Phone
                            <input
                              className="vendor-field mt-1 w-full rounded-lg px-2 py-1.5 text-sm"
                              value={c.phone ?? ""}
                              onChange={(e) => updateContact(i, { phone: e.target.value })}
                            />
                          </label>
                          <label className="text-xs text-neutral-500">
                            Email
                            <input
                              className="vendor-field mt-1 w-full rounded-lg px-2 py-1.5 text-sm"
                              value={c.email ?? ""}
                              onChange={(e) => updateContact(i, { email: e.target.value })}
                            />
                          </label>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeContact(i)}
                          className="mt-2 text-xs font-semibold text-rose-300/90 hover:text-rose-200"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <div className="flex justify-end border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={saveProfile}
                  className="rounded-lg bg-brand-orange px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-orange-hover"
                >
                  Save profile
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {ledgerOpen && selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div
            className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-white/15 bg-neutral-950 shadow-2xl"
            role="dialog"
            aria-modal
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Creditors ledger</h3>
                <p className="text-xs text-neutral-500">{selected.name} · AP {money(apBalance)}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={printCreditorLedger}
                  className="rounded-lg bg-brand-orange px-3 py-2 text-sm font-semibold text-white hover:bg-brand-orange-hover"
                >
                  Print
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerOpen(false)}
                  className="rounded-lg border border-white/20 px-3 py-2 text-sm text-white hover:border-brand-orange"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="overflow-auto p-5">
              <div className="mb-4 grid gap-2 sm:grid-cols-5">
                {(Object.keys(bucketTotals) as DueBucketLabel[]).map((k) => (
                  <div key={k} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-center">
                    <p className="text-[10px] font-medium text-neutral-500">{k}</p>
                    <p className="mt-1 font-mono text-sm font-semibold text-white">{money(bucketTotals[k])}</p>
                  </div>
                ))}
              </div>
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[800px] text-left text-sm">
                  <thead className="bg-white/[0.06] text-xs font-semibold uppercase tracking-wide text-neutral-400">
                    <tr>
                      <th className="px-3 py-2">Document</th>
                      <th className="px-3 py-2">Invoice</th>
                      <th className="px-3 py-2">Due</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2">Due bucket</th>
                      <th className="px-3 py-2">Invoice age</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerRows.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-8 text-center text-neutral-500">
                          No credit invoices for this supplier yet.
                        </td>
                      </tr>
                    ) : (
                      ledgerRows.map((r) => (
                        <tr key={r.id} className="border-t border-white/10">
                          <td className="px-3 py-2 font-mono text-neutral-200">{r.poReference}</td>
                          <td className="px-3 py-2 text-neutral-400">{fmtDate(r.invoiceDate)}</td>
                          <td className="px-3 py-2 text-neutral-400">{fmtDate(r.dueDate)}</td>
                          <td className="px-3 py-2 text-right font-mono text-white">{money(r.amount)}</td>
                          <td className="px-3 py-2 text-neutral-300">{r.dueBucket}</td>
                          <td className="px-3 py-2 text-neutral-400">
                            {r.invoiceAgeBucket} ({r.invoiceAgeDays}d)
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
