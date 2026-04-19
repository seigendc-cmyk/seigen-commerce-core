"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { landUnitCostFromReadModel } from "@/modules/financial/lib/cogs-cost";
import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";
import { listProductReadModels } from "@/modules/inventory/services/product-read-model";
import {
  listStocktakeSessions,
  postStocktake,
  type StocktakeSession,
} from "@/modules/inventory/services/stocktake-service";
import type { ProductReadModel } from "@/modules/inventory/types/product-read-model";

function money(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

type CountMap = Record<string, string>;

export function InventoryStocktakeTab({ onPosted }: { onPosted: () => void }) {
  const branch = useMemo(() => InventoryRepo.getDefaultBranch(), []);
  const [search, setSearch] = useState("");
  const [memo, setMemo] = useState("");
  const [counts, setCounts] = useState<CountMap>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [sessions, setSessions] = useState<StocktakeSession[]>(() => listStocktakeSessions(20));

  const rows = useMemo(() => {
    const all = listProductReadModels(branch.id);
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode?.toLowerCase().includes(q) ?? false),
    );
  }, [branch.id, search]);

  const refreshSessions = useCallback(() => setSessions(listStocktakeSessions(20)), []);

  function setCount(productId: string, value: string) {
    setCounts((prev) => ({ ...prev, [productId]: value }));
  }

  const preview = useMemo(() => {
    const items: {
      p: ProductReadModel;
      system: number;
      counted: number | null;
      variance: number | null;
      value: number;
    }[] = [];
    let totalAbs = 0;
    for (const p of rows) {
      const raw = counts[p.id]?.trim();
      if (raw === undefined || raw === "") continue;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) continue;
      const counted = Math.floor(n);
      const system = p.onHandQty;
      const variance = counted - system;
      const uc = landUnitCostFromReadModel(p);
      const value = Math.round(variance * uc * 100) / 100;
      totalAbs += Math.abs(value);
      items.push({ p, system, counted, variance, value });
    }
    return { items, totalAbs };
  }, [rows, counts]);

  function submit() {
    setMsg(null);
    const payload: { productId: string; countedQty: number }[] = [];
    for (const row of preview.items) {
      payload.push({ productId: row.p.id, countedQty: row.counted! });
    }
    if (payload.length === 0) {
      setMsg("Enter counted quantities for at least one SKU with a variance vs system.");
      return;
    }
    setBusy(true);
    try {
      const r = postStocktake({ branchId: branch.id, memo, counts: payload });
      if (!r.ok) {
        setMsg(r.error);
        return;
      }
      setMsg(`Posted stocktake ${r.session.id.slice(-10)} · ${r.session.lines.length} adjustment(s).`);
      setCounts({});
      setMemo("");
      refreshSessions();
      onPosted();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="vendor-panel-soft rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white">Physical stocktake</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-300">
          Enter <span className="text-neutral-100">physical counts</span> for each SKU you have counted. Only lines with
          a number are included. On post, the system updates branch stock and records{" "}
          <span className="text-neutral-100">inventory valuation adjustments</span> at standard cost (average / unit
          cost) for P&amp;L and audit. Shrinkage posts as negative value; overage as positive.
        </p>
        <p className="mt-3 text-xs text-neutral-500">
          Branch: <span className="font-mono text-neutral-400">{branch.name}</span> ·{" "}
          <Link href="/dashboard/financial" className="font-semibold text-brand-orange hover:underline">
            Financial
          </Link>{" "}
          consumes the same local ledgers for reporting.
        </p>
      </section>

      <section className="vendor-panel-soft rounded-2xl p-6">
        <div className="flex flex-wrap items-end gap-4">
          <label className="block min-w-[200px] flex-1 text-sm">
            <span className="text-neutral-400">Search catalog</span>
            <input
              className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="SKU, name, barcode…"
            />
          </label>
          <label className="block min-w-[240px] flex-[2] text-sm">
            <span className="text-neutral-400">Session memo (optional)</span>
            <input
              className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="e.g. Cycle count Aisle 3 · Feb close"
            />
          </label>
        </div>

        <div className="mt-6 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.04] text-xs font-semibold uppercase tracking-wide text-neutral-400">
              <tr>
                <th className="px-3 py-2">SKU</th>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2 text-right">System</th>
                <th className="px-3 py-2 text-right">Counted</th>
                <th className="px-3 py-2 text-right">Variance</th>
                <th className="px-3 py-2 text-right">Value @ cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-neutral-500">
                    No products match your search.
                  </td>
                </tr>
              ) : (
                rows.map((p) => {
                  const raw = counts[p.id] ?? "";
                  const n = raw.trim() === "" ? null : Number(raw);
                  const counted = n !== null && Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
                  const variance =
                    counted !== null ? counted - p.onHandQty : null;
                  const uc = landUnitCostFromReadModel(p);
                  const value =
                    variance !== null ? Math.round(variance * uc * 100) / 100 : null;
                  return (
                    <tr key={p.id} className="border-b border-white/[0.06] last:border-0">
                      <td className="px-3 py-2 font-mono text-xs text-neutral-400">{p.sku}</td>
                      <td className="px-3 py-2 text-neutral-200">{p.name}</td>
                      <td className="px-3 py-2 text-right font-mono text-neutral-300">{p.onHandQty}</td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          className="vendor-field w-24 rounded-lg px-2 py-1.5 text-right font-mono text-sm"
                          value={raw}
                          placeholder="—"
                          onChange={(e) => setCount(p.id, e.target.value)}
                          aria-label={`Counted qty ${p.sku}`}
                        />
                      </td>
                      <td
                        className={[
                          "px-3 py-2 text-right font-mono",
                          variance === null
                            ? "text-neutral-600"
                            : variance === 0
                              ? "text-neutral-400"
                              : variance > 0
                                ? "text-emerald-300"
                                : "text-rose-300",
                        ].join(" ")}
                      >
                        {variance === null ? "—" : variance > 0 ? `+${variance}` : String(variance)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-neutral-300">
                        {value === null ? "—" : money(value)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {preview.items.length > 0 ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-neutral-300">
            <span className="text-neutral-400">Preview · </span>
            {preview.items.length} line(s) with a count · combined absolute value movement{" "}
            <span className="font-mono font-semibold text-white">{money(preview.totalAbs)}</span>
          </div>
        ) : null}

        {msg ? (
          <p className={`mt-4 text-sm ${msg.startsWith("Posted") ? "text-emerald-300" : "text-amber-200"}`}>{msg}</p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || preview.items.length === 0}
            onClick={() => submit()}
            className="rounded-lg bg-brand-orange px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-orange-hover disabled:opacity-40"
          >
            {busy ? "Posting…" : "Post adjustments to stock & P&L ledger"}
          </button>
        </div>
      </section>

      <section className="vendor-panel-soft rounded-2xl p-6">
        <h3 className="text-base font-semibold text-white">Recent stocktakes</h3>
        <p className="mt-1 text-xs text-neutral-500">Audit trail of posted sessions (this branch).</p>
        <ul className="mt-4 space-y-3">
          {sessions.length === 0 ? (
            <li className="text-sm text-neutral-500">No sessions yet.</li>
          ) : (
            sessions.map((s) => (
              <li key={s.id} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-mono text-xs text-neutral-500">{s.id}</span>
                  <span className="text-xs text-neutral-500">
                    {new Date(s.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                </div>
                <p className="mt-1 text-neutral-300">{s.memo || "—"}</p>
                <p className="mt-2 text-xs text-neutral-500">
                  {s.lines.length} line(s) · net value{" "}
                  <span className="font-mono text-neutral-200">
                    {money(s.lines.reduce((a, l) => a + l.valueImpact, 0))}
                  </span>
                </p>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
