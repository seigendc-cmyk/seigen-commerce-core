"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FINANCIAL_LEDGERS_UPDATED_EVENT } from "@/modules/financial/services/financial-events";
import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";
import {
  buildProductHistory,
  type ProductHistoryKind,
  type ProductHistoryRow,
} from "@/modules/inventory/services/product-history";
import { posSalesStorageKey } from "@/modules/pos/services/sales-service";
import type { ProductReadModel } from "@/modules/inventory/types/product-read-model";
import { inventoryKeys } from "@/modules/inventory/services/inventory-repo";
import { purchasingKeys } from "@/modules/inventory/services/purchasing-service";
import { receivingKeys } from "@/modules/inventory/services/receiving-service";
import { stockAdjustmentLedgerStorageKey } from "@/modules/financial/services/stock-adjustment-ledger";

function money(n: number | null) {
  if (n === null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function kindLabel(k: ProductHistoryKind): string {
  switch (k) {
    case "sale":
      return "Sale";
    case "stock_adjustment":
      return "Stock adjustment";
    case "purchase_order":
      return "Purchase";
    case "goods_receipt":
      return "Receiving";
    default:
      return k;
  }
}

function defaultFromDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

type Props = {
  product: ProductReadModel;
  onClose: () => void;
};

export function ProductHistoryModal({ product, onClose }: Props) {
  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState(todayDate);
  const [branchId, setBranchId] = useState<string>("all");
  const [tick, setTick] = useState(0);

  const branches = useMemo(() => InventoryRepo.listBranches(), []);

  const bump = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (
        e.key === inventoryKeys.db ||
        e.key === purchasingKeys.purchasing ||
        e.key === receivingKeys.receiving ||
        e.key === posSalesStorageKey ||
        e.key === stockAdjustmentLedgerStorageKey()
      ) {
        bump();
      }
    };
    const onFin = () => bump();
    window.addEventListener("storage", onStorage);
    window.addEventListener(FINANCIAL_LEDGERS_UPDATED_EVENT, onFin);
    window.addEventListener("seigen-pos-sale-recorded", bump);
    window.addEventListener("seigen-stocktake-posted", bump);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(FINANCIAL_LEDGERS_UPDATED_EVENT, onFin);
      window.removeEventListener("seigen-pos-sale-recorded", bump);
      window.removeEventListener("seigen-stocktake-posted", bump);
    };
  }, [bump]);

  const rows = useMemo((): ProductHistoryRow[] => {
    void tick;
    return buildProductHistory(product.id, {
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      branchId: branchId === "all" ? "all" : branchId,
    });
  }, [product.id, fromDate, toDate, branchId, tick]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-history-title"
    >
      <div className="flex max-h-[min(92vh,880px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-neutral-950 shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id="product-history-title" className="text-lg font-semibold text-white">
              Product history
            </h2>
            <p className="mt-1 truncate text-sm text-neutral-400">
              <span className="font-mono text-neutral-300">{product.sku}</span>
              <span className="mx-2 text-neutral-600">·</span>
              <span className="text-neutral-200">{product.name}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:border-brand-orange"
          >
            Close
          </button>
        </div>

        <div className="border-b border-white/10 bg-white/[0.03] px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block text-xs text-neutral-400">
              <span className="mb-1 block font-medium text-neutral-300">From</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="vendor-field rounded-lg px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-xs text-neutral-400">
              <span className="mb-1 block font-medium text-neutral-300">To</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="vendor-field rounded-lg px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block min-w-[160px] flex-1 text-xs text-neutral-400 sm:max-w-xs">
              <span className="mb-1 block font-medium text-neutral-300">Shop / branch</span>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="vendor-field w-full rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="all">All branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name || b.id}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => {
                setFromDate("");
                setToDate("");
              }}
              className="mb-0.5 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-neutral-300 hover:border-brand-orange hover:text-white"
            >
              Clear dates
            </button>
            <button
              type="button"
              onClick={bump}
              className="mb-0.5 rounded-lg bg-brand-orange px-3 py-2 text-xs font-semibold text-white hover:bg-brand-orange-hover"
            >
              Refresh
            </button>
          </div>
          <p className="mt-3 text-xs text-neutral-500">
            Includes POS sales, stocktake adjustments, purchase orders, and goods receipts stored locally.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4 sm:px-6">
          {rows.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-12 text-center text-sm text-neutral-400">
              No events in this range. Widen dates, choose <span className="text-neutral-200">All branches</span>, or
              record sales and inventory activity.
            </div>
          ) : (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="sticky top-0 border-b border-white/10 bg-neutral-950 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                <tr>
                  <th className="py-2 pr-3">When</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Branch</th>
                  <th className="py-2 pr-3">Ref</th>
                  <th className="py-2 pr-3 text-right">Qty Δ</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {rows.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="py-3 pr-3 whitespace-nowrap text-neutral-300">
                      {new Date(r.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                    </td>
                    <td className="py-3 pr-3">
                      <span className="font-medium text-white">{kindLabel(r.kind)}</span>
                      <span className="mt-0.5 block text-xs text-neutral-500">{r.title}</span>
                    </td>
                    <td className="py-3 pr-3 text-neutral-400">{r.branchName}</td>
                    <td className="max-w-[200px] py-3 pr-3 font-mono text-xs text-neutral-300">{r.ref}</td>
                    <td
                      className={[
                        "py-3 pr-3 text-right font-mono tabular-nums",
                        r.qtyDelta === null
                          ? "text-neutral-500"
                          : r.qtyDelta < 0
                            ? "text-rose-200"
                            : r.qtyDelta > 0
                              ? "text-emerald-200"
                              : "text-neutral-400",
                      ].join(" ")}
                    >
                      {r.qtyDelta === null ? "—" : r.qtyDelta > 0 ? `+${r.qtyDelta}` : String(r.qtyDelta)}
                    </td>
                    <td className="py-3 text-right font-mono text-neutral-200 tabular-nums">{money(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {rows.length > 0 ? (
            <p className="mt-4 text-xs text-neutral-500">
              {rows.map((r) => r.detail).find(Boolean) ? (
                <span className="line-clamp-2">Latest detail: {rows[0].detail}</span>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
