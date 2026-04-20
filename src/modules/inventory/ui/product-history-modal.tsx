"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FINANCIAL_LEDGERS_UPDATED_EVENT } from "@/modules/financial/services/financial-events";
import {
  buildProductHistory,
  type ProductHistoryKind,
  type ProductHistoryRow,
} from "@/modules/inventory/services/product-history";
import {
  downloadProductHistoryPdf,
  openProductHistoryPrintWindow,
  shareProductHistoryPdf,
  type ProductHistoryRunningRow,
} from "@/modules/inventory/services/product-history-report";
import { InventoryRepo, inventoryKeys } from "@/modules/inventory/services/inventory-repo";
import type { ProductReadModel } from "@/modules/inventory/types/product-read-model";
import { WindowControls } from "@/components/ui/window-controls";
import { posSalesStorageKey } from "@/modules/pos/services/sales-service";
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

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfMonth(d = new Date()): string {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  return dateKey(x);
}

function startOfYear(d = new Date()): string {
  const x = new Date(d.getFullYear(), 0, 1);
  return dateKey(x);
}

function addDaysKey(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return dateKey(d);
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
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);

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

  const rowsWithRunning = useMemo((): ProductHistoryRunningRow[] => {
    // Running totals should be chronological (oldest → newest) for meaning.
    const asc = [...rows].sort((a, b) => a.at.localeCompare(b.at));
    let runQty: number | null = 0;
    let runCost: number | null = 0;
    const map = new Map<string, { q: number | null; c: number | null }>();
    for (const r of asc) {
      if (runQty != null && r.qtyDelta != null) runQty += r.qtyDelta;
      if (runCost != null && r.amount != null) runCost += r.amount;
      map.set(r.id, { q: runQty, c: runCost });
    }
    return rows.map((r) => {
      const x = map.get(r.id);
      return { ...r, runningQty: x?.q ?? null, runningCost: x?.c ?? null };
    });
  }, [rows]);

  const filtersLabel = useMemo(() => {
    const range = `${fromDate || "…"} → ${toDate || "…"}`;
    const br = branchId === "all" ? "All branches" : InventoryRepo.getBranch(branchId)?.name || branchId;
    return `Range: ${range} · Branch: ${br}`;
  }, [fromDate, toDate, branchId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-history-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[94vh] w-full max-w-[min(96vw,84rem)] flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-black/10 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id="product-history-title" className="text-lg font-semibold text-neutral-900">
              Product history
            </h2>
            <p className="mt-1 truncate text-sm text-neutral-600">
              <span className="font-mono text-neutral-800">{product.sku}</span>
              <span className="mx-2 text-neutral-300">·</span>
              <span className="text-neutral-800">{product.name}</span>
            </p>
            <p className="mt-1 text-xs text-neutral-500">{filtersLabel}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openProductHistoryPrintWindow({
                title: "seiGEN — Product history",
                subtitle: `${product.sku} · ${product.name}`,
                generatedAt: new Date().toLocaleString(),
                filtersLabel,
                rows: rowsWithRunning,
              })}
              className="shrink-0 rounded-lg bg-black/5 px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-black/10"
            >
              Print / Save as PDF
            </button>
            <button
              type="button"
              onClick={() => void downloadProductHistoryPdf({
                title: "seiGEN — Product history",
                subtitle: `${product.sku} · ${product.name}`,
                generatedAt: new Date().toLocaleString(),
                filtersLabel,
                rows: rowsWithRunning,
              })}
              className="shrink-0 rounded-lg border border-brand-orange/50 bg-brand-orange/10 px-3 py-2 text-sm font-semibold text-brand-orange hover:bg-brand-orange/20"
            >
              Download PDF
            </button>
            <button
              type="button"
              onClick={() => {
                setShareMsg(null);
                void shareProductHistoryPdf({
                  title: "seiGEN — Product history",
                  subtitle: `${product.sku} · ${product.name}`,
                  generatedAt: new Date().toLocaleString(),
                  filtersLabel,
                  rows: rowsWithRunning,
                }).then((r) => {
                  if (!r.ok) setShareMsg(r.reason);
                });
              }}
              className="shrink-0 rounded-lg border border-black/15 bg-white px-3 py-2 text-sm font-semibold text-neutral-900 hover:bg-black/5"
            >
              Share PDF (WhatsApp / Telegram…)
            </button>
            <WindowControls
              minimized={minimized}
              onMinimize={() => setMinimized(true)}
              onRestore={() => setMinimized(false)}
              onClose={onClose}
            />
          </div>
        </div>

        {minimized ? null : (
          <>
        <div className="border-b border-black/10 bg-black/[0.02] px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-wrap items-center gap-2 pb-1 text-xs">
              <span className="font-semibold text-neutral-700">Period</span>
              <button
                type="button"
                onClick={() => {
                  setFromDate(addDaysKey(-7));
                  setToDate(todayDate());
                }}
                className="rounded-md bg-black/5 px-2 py-1 font-semibold text-neutral-900 hover:bg-black/10"
              >
                Week
              </button>
              <button
                type="button"
                onClick={() => {
                  setFromDate(startOfMonth());
                  setToDate(todayDate());
                }}
                className="rounded-md bg-black/5 px-2 py-1 font-semibold text-neutral-900 hover:bg-black/10"
              >
                Month
              </button>
              <button
                type="button"
                onClick={() => {
                  setFromDate(startOfYear());
                  setToDate(todayDate());
                }}
                className="rounded-md bg-black/5 px-2 py-1 font-semibold text-neutral-900 hover:bg-black/10"
              >
                Year
              </button>
            </div>

            <label className="block text-xs text-neutral-600">
              <span className="mb-1 block font-medium text-neutral-700">From</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-[170px] rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900"
              />
            </label>
            <label className="block text-xs text-neutral-600">
              <span className="mb-1 block font-medium text-neutral-700">To</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-[170px] rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900"
              />
            </label>
            <label className="block min-w-[160px] flex-1 text-xs text-neutral-600 sm:max-w-xs">
              <span className="mb-1 block font-medium text-neutral-700">Shop / branch</span>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-neutral-900"
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
              className="mb-0.5 rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 hover:border-brand-orange hover:text-neutral-900"
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
          {shareMsg ? <p className="mt-3 text-xs text-amber-700">{shareMsg}</p> : null}
          <p className="mt-3 text-xs text-neutral-500">
            Includes POS sales, stocktake adjustments, purchase orders, and goods receipts stored locally.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-4 sm:px-6">
          {rows.length === 0 ? (
            <div className="rounded-xl border border-black/10 bg-black/[0.02] px-4 py-12 text-center text-sm text-neutral-600">
              No events in this range. Widen dates, choose <span className="text-neutral-200">All branches</span>, or
              record sales and inventory activity.
            </div>
          ) : (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="sticky top-0 border-b border-black/10 bg-white text-xs font-semibold uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="py-2 pr-3">When</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Branch</th>
                  <th className="py-2 pr-3">Ref</th>
                  <th className="py-2 pr-3 text-right">Qty Δ</th>
                  <th className="py-2 pr-3 text-right">Amount</th>
                  <th className="py-2 pr-3 text-right">Running qty</th>
                  <th className="py-2 text-right">Running cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06]">
                {rowsWithRunning.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="py-3 pr-3 whitespace-nowrap text-neutral-700">
                      {new Date(r.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                    </td>
                    <td className="max-w-[min(320px,40vw)] py-3 pr-3">
                      <span className="font-medium text-neutral-900">{kindLabel(r.kind)}</span>
                      <span className="mt-0.5 block text-xs text-neutral-600">{r.title}</span>
                      <p className="mt-1 line-clamp-3 text-xs text-neutral-600">{r.detail}</p>
                    </td>
                    <td className="py-3 pr-3 text-neutral-700">{r.branchName}</td>
                    <td className="max-w-[200px] py-3 pr-3 font-mono text-xs text-neutral-700">{r.ref}</td>
                    <td
                      className={[
                        "py-3 pr-3 text-right font-mono tabular-nums",
                        r.qtyDelta === null
                          ? "text-neutral-400"
                          : r.qtyDelta < 0
                            ? "text-rose-700"
                            : r.qtyDelta > 0
                              ? "text-emerald-700"
                              : "text-neutral-500",
                      ].join(" ")}
                    >
                      {r.qtyDelta === null ? "—" : r.qtyDelta > 0 ? `+${r.qtyDelta}` : String(r.qtyDelta)}
                    </td>
                    <td className="py-3 pr-3 text-right font-mono text-neutral-900 tabular-nums">{money(r.amount)}</td>
                    <td className="py-3 pr-3 text-right font-mono text-neutral-900 tabular-nums">
                      {r.runningQty == null ? "—" : r.runningQty}
                    </td>
                    <td className="py-3 text-right font-mono text-neutral-900 tabular-nums">{money(r.runningCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
          </>
        )}
      </div>
    </div>
  );
}
