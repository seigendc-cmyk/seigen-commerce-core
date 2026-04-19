"use client";

import { useCallback, useId, useMemo, useRef, useState } from "react";
import {
  ACCOUNT_CLASS_OPTIONS,
  canAddSubaccount,
  emptyCoaRow,
  hasChildren,
  labelForAccountClass,
  normalBalanceForClass,
  type AccountClass,
  type CoaAccountRow,
} from "@/modules/dashboard/settings/coa/coa-types";

function sortRows(rows: CoaAccountRow[]): CoaAccountRow[] {
  return [...rows].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
}

export function CoaSettingsForm() {
  const rootId = useId();
  const nextSeq = useRef(1);

  const [rows, setRows] = useState<CoaAccountRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savedHint, setSavedHint] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const sorted = useMemo(() => sortRows(rows), [rows]);

  const updateRow = useCallback((id: string, patch: Partial<CoaAccountRow>) => {
    setListError(null);
    setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const addTopLevel = useCallback(() => {
    const id = `${rootId}-coa${nextSeq.current++}`;
    setListError(null);
    setRows((list) => [...list, emptyCoaRow(id, null)]);
    setExpandedId(id);
  }, [rootId]);

  const addSubaccount = useCallback((parentId: string) => {
    const parent = rows.find((r) => r.id === parentId);
    if (!parent || !canAddSubaccount(parent)) {
      setListError("You can add at most three subaccount levels under each top-level account.");
      return;
    }
    const id = `${rootId}-coa${nextSeq.current++}`;
    setListError(null);
    setRows((list) => [...list, emptyCoaRow(id, parent)]);
    setExpandedId(id);
  }, [rows, rootId]);

  const removeRow = useCallback(
    (id: string) => {
      setListError(null);
      if (hasChildren(rows, id)) {
        setListError("Remove or reassign subaccounts before deleting this account.");
        return;
      }
      setRows((list) => list.filter((r) => r.id !== id));
      setExpandedId((cur) => (cur === id ? null : cur));
    },
    [rows],
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavedHint(
      "Draft saved locally — journal validation, period close, and integrations with cashbooks and banks connect when your ledger service is wired.",
    );
    window.setTimeout(() => setSavedHint(null), 4000);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="vendor-panel rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white">Chart of accounts</h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-300">
          Build your financial account tree with up to <span className="text-neutral-100">three subaccount levels</span>{" "}
          under each top-level code. Every posting in seiGEN will target these accounts. The general ledger enforces{" "}
          <span className="text-neutral-100">double-entry</span>: each journal balances total debits and credits, and
          normal balances follow account class (e.g. assets and expenses debit-increase; liabilities, equity, and revenue
          credit-increase).
        </p>
      </section>

      <section className="vendor-panel-soft rounded-2xl p-6 text-sm text-neutral-300">
        <p className="font-medium text-white">Integrations</p>
        <p className="mt-2 text-neutral-400">
          This COA will tie to <span className="text-neutral-200">cashbooks</span> (cash and bank journals),{" "}
          <span className="text-neutral-200">COGS</span> and inventory valuation,{" "}
          <span className="text-neutral-200">bank</span> feeds from the Banks tab, <span className="text-neutral-200">POS</span>{" "}
          sales and tender types, and other operational transactions so reporting stays consistent end-to-end.
        </p>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-white">Account table</h2>
        <button
          type="button"
          onClick={addTopLevel}
          className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:border-brand-orange hover:text-brand-orange"
        >
          Add top-level account
        </button>
      </div>

      {listError ? (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {listError}
        </div>
      ) : null}

      {sorted.length === 0 ? (
        <div className="vendor-empty rounded-2xl px-4 py-8 text-center text-sm text-neutral-400">
          No accounts yet. Add a top-level account (e.g. 1000 — Assets), then add subaccounts for banks, till cash, and
          inventory.
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((r) => {
            const open = expandedId === r.id;
            const nb = normalBalanceForClass(r.class);
            const indent = r.level * 14;
            return (
              <div
                key={r.id}
                className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]"
                style={{ marginLeft: indent }}
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(open ? null : r.id)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-white/[0.06]"
                >
                  <span className="min-w-0 text-sm text-white">
                    <span className="font-mono text-xs text-brand-orange/95">{r.code.trim() || "—"}</span>
                    <span className="mx-2 text-neutral-500">·</span>
                    <span className="font-medium">{r.name.trim() || "Untitled"}</span>
                    <span className="ml-2 text-xs text-neutral-500">
                      {labelForAccountClass(r.class)} · {nb} balance · L{r.level}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-neutral-500">{open ? "Hide" : "Edit"}</span>
                </button>
                {open ? (
                  <div className="space-y-3 border-t border-white/10 px-3 py-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium text-neutral-400" htmlFor={`coa-code-${r.id}`}>
                          Code
                        </label>
                        <input
                          id={`coa-code-${r.id}`}
                          value={r.code}
                          onChange={(e) => updateRow(r.id, { code: e.target.value })}
                          className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm font-mono"
                          placeholder="e.g. 1110"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-neutral-400" htmlFor={`coa-name-${r.id}`}>
                          Name
                        </label>
                        <input
                          id={`coa-name-${r.id}`}
                          value={r.name}
                          onChange={(e) => updateRow(r.id, { name: e.target.value })}
                          className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                          placeholder="e.g. Bank — operating"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-400" htmlFor={`coa-class-${r.id}`}>
                        Account class
                      </label>
                      <select
                        id={`coa-class-${r.id}`}
                        value={r.class}
                        onChange={(e) => updateRow(r.id, { class: e.target.value as AccountClass })}
                        className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                      >
                        {ACCOUNT_CLASS_OPTIONS.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label} (normal {o.normalBalance})
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="text-xs text-neutral-500">
                      Parent:{" "}
                      {r.parentId ? (
                        <span className="font-mono text-neutral-300">
                          {rows.find((x) => x.id === r.parentId)?.code ?? r.parentId}
                        </span>
                      ) : (
                        "— (top-level)"
                      )}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {canAddSubaccount(r) ? (
                        <button
                          type="button"
                          onClick={() => addSubaccount(r.id)}
                          className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15"
                        >
                          Add subaccount
                        </button>
                      ) : (
                        <span className="text-xs text-neutral-500">Maximum depth reached (3 sub-levels).</span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeRow(r.id)}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-300/90 hover:text-red-200"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <div className="vendor-panel-soft rounded-2xl px-5 py-4 text-sm text-neutral-300">
        <p className="font-medium text-white">Double-entry logic</p>
        <p className="mt-1 text-neutral-400">
          Journals will require balanced lines: sum of debits equals sum of credits per entry. Inventory receipts, sales,
          payments, and bank transfers will propose default account pairs you can override where policy allows—always
          keeping the books in balance.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-95"
        >
          Save draft
        </button>
        {savedHint ? <p className="text-sm text-neutral-400">{savedHint}</p> : null}
      </div>
    </form>
  );
}
