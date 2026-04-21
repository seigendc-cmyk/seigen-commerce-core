"use client";

import { useEffect, useState } from "react";
import { listSales, posSalesStorageKey } from "../services/sales-service";
import { receiptMetaForLocalSale } from "../services/receipt-meta";
import type { Sale } from "../types/pos";
import { ReceiptDetailPanel } from "./receipt-detail-panel";

function money(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function formatWhen(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

type Props = {
  refreshTrigger?: number;
  pinnedSale?: Sale | null;
  onDismissPin?: () => void;
};

export function PosSalesHistory({ refreshTrigger = 0, pinnedSale = null, onDismissPin }: Props) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function refresh() {
    setSales(listSales().slice(0, 20));
  }

  useEffect(() => {
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === posSalesStorageKey) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refreshTrigger]);

  const selected = selectedId ? (sales.find((s) => s.id === selectedId) ?? null) : null;
  const showSelectedPanel = Boolean(selected && (!pinnedSale || selected.id !== pinnedSale.id));

  return (
    <section className="vendor-panel rounded-2xl">
      <div className="border-b border-white/10 px-4 py-3">
        <h2 className="text-sm font-semibold text-white">Recent sales</h2>
        <p className="mt-0.5 text-xs text-neutral-400">Last 20 receipts · {posSalesStorageKey}</p>
      </div>

      <div className="max-h-[min(70vh,520px)] overflow-y-auto p-3 space-y-3">
        {pinnedSale ? (
          <ReceiptDetailPanel
            sale={pinnedSale}
            meta={receiptMetaForLocalSale(pinnedSale)}
            title="Latest receipt"
            onDismiss={onDismissPin}
            dismissLabel="Dismiss"
          />
        ) : null}

        {sales.length === 0 ? (
          <p className="px-2 py-4 text-sm text-neutral-300">No completed sales yet.</p>
        ) : (
          <ul className="space-y-1">
            {sales.map((s) => {
              const isSelected = selectedId === s.id;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(isSelected ? null : s.id)}
                    className={`flex w-full flex-col rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                      isSelected
                        ? "border-teal-500/50 bg-teal-600/10"
                        : "border-white/5 bg-brand-charcoal/40 hover:border-white/15"
                    }`}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2 text-neutral-200">
                      <span className="font-mono font-semibold text-teal-600">{s.receiptNumber}</span>
                      <span className="text-neutral-400">{formatWhen(s.createdAt)}</span>
                    </div>
                    <div className="mt-1 flex justify-between gap-2 text-neutral-300">
                      <span>
                        {s.status} · {s.lines.length} line{s.lines.length === 1 ? "" : "s"}
                      </span>
                      <span className="font-medium text-white">{money(s.amountDue ?? s.subtotal)}</span>
                    </div>
                    <span className="mt-1 text-[10px] text-neutral-500">
                      {isSelected ? "Hide receipt" : "Preview · print · download · share"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {showSelectedPanel && selected ? (
          <ReceiptDetailPanel
            sale={selected}
            meta={receiptMetaForLocalSale(selected)}
            title="Receipt details"
            onDismiss={() => setSelectedId(null)}
            dismissLabel="Close"
          />
        ) : null}
      </div>
    </section>
  );
}
