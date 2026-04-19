"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  COA_INVENTORY_ASSET_CODE,
  COA_INVENTORY_COUNT_GAIN_CODE,
  COA_INVENTORY_SHRINKAGE_EXPENSE_CODE,
  generalJournalStorageKey,
} from "@/modules/financial/services/general-journal-ledger";
import {
  labelStockAdjustmentKind,
  listStockAdjustmentEntries,
  stockAdjustmentLedgerStorageKey,
  totalStockAdjustmentValueImpact,
} from "@/modules/financial/services/stock-adjustment-ledger";

function money(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function displayRef(e: { reference?: string; stocktakeId: string }) {
  return e.reference?.trim() || `ST-${e.stocktakeId.slice(-10)}`;
}

export function StockAdjustmentsTab({ tick }: { tick: number }) {
  const entries = useMemo(() => {
    void tick;
    return listStockAdjustmentEntries(200);
  }, [tick]);

  const netImpact = useMemo(() => {
    void tick;
    return totalStockAdjustmentValueImpact();
  }, [tick]);

  return (
    <div className="space-y-6">
      <section className="vendor-panel-soft rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Stock adjustments</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-300">
              Each line is a quantity correction at standard (landed) cost. Shrinkage reduces inventory and books to{" "}
              <span className="font-mono text-neutral-200">{COA_INVENTORY_SHRINKAGE_EXPENSE_CODE}</span>; overages
              increase inventory (
              <span className="font-mono text-neutral-200">{COA_INVENTORY_ASSET_CODE}</span>) and{" "}
              <span className="font-mono text-neutral-200">{COA_INVENTORY_COUNT_GAIN_CODE}</span>. Postings hit the
              general journal for P&amp;L.
            </p>
          </div>
          <div
            className={[
              "rounded-xl border px-4 py-3 text-right",
              netImpact >= 0
                ? "border-emerald-500/30 bg-emerald-500/10"
                : "border-rose-500/30 bg-rose-500/10",
            ].join(" ")}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-300">Net at standard cost</p>
            <p
              className={[
                "mt-1 font-mono text-2xl font-bold",
                netImpact >= 0 ? "text-emerald-200" : "text-rose-200",
              ].join(" ")}
            >
              {netImpact >= 0 ? "+" : ""}
              {money(netImpact)}
            </p>
            <p className="mt-1 text-[10px] text-neutral-500">Cumulative value impact</p>
          </div>
        </div>

        <p className="mt-4 text-xs text-neutral-500">
          Sub-ledger: <span className="font-mono">{stockAdjustmentLedgerStorageKey()}</span>
          <span className="mx-2 text-neutral-600">·</span>
          GL: <span className="font-mono">{generalJournalStorageKey()}</span>
        </p>

        <div className="mt-6 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.04] text-xs font-semibold uppercase tracking-wide text-neutral-400">
              <tr>
                <th className="px-3 py-2">Ref</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-neutral-400">
                    No adjustments yet. Post a physical count under{" "}
                    <Link
                      href="/dashboard/inventory?tab=stocktake"
                      className="font-semibold text-brand-orange hover:underline"
                    >
                      Inventory → Stocktake
                    </Link>
                    .
                  </td>
                </tr>
              ) : (
                entries.map((e) => (
                  <tr key={e.id} className="border-b border-white/[0.06] last:border-0">
                    <td className="px-3 py-2.5 font-mono text-neutral-200">{displayRef(e)}</td>
                    <td className="px-3 py-2.5 text-neutral-300">{labelStockAdjustmentKind(e.adjustmentKind)}</td>
                    <td className="max-w-[220px] px-3 py-2.5 text-neutral-400">
                      <span className="line-clamp-2 text-neutral-200">{e.name}</span>
                      <span className="mt-0.5 block font-mono text-xs text-neutral-500">{e.sku}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-neutral-400">
                      {new Date(e.createdAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                    <td
                      className={[
                        "px-3 py-2.5 text-right font-mono font-semibold",
                        e.valueImpact >= 0 ? "text-emerald-200" : "text-rose-200",
                      ].join(" ")}
                    >
                      {e.valueImpact >= 0 ? "+" : ""}
                      {money(e.valueImpact)}
                    </td>
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
