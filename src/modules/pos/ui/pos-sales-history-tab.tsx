"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getProductReadModel } from "@/modules/inventory/services/product-read-model";
import type { ProductReadModel } from "@/modules/inventory/types/product-read-model";
import { labelForInventoryItemType } from "@/modules/inventory/types/inventory-product-meta";
import { authzCheck } from "@/modules/authz/authz-actions";
import { emitPosReceiptReprintedBrainEventDurable, emitPosSaleVoidedBrainEventDurable } from "@/modules/brain/brain-outbox";
import { appendDeskAuditEvent } from "@/modules/desk/services/desk-audit";
import {
  defaultHistoryColumns,
  HISTORY_COLUMN_DEFS,
  loadHistoryColumnVisibility,
  saveHistoryColumnVisibility,
  type HistoryColumnId,
} from "../services/pos-history-column-prefs";
import { listSales, posSalesStorageKey, voidSale } from "../services/sales-service";
import { receiptMetaForLocalSale } from "../services/receipt-meta";
import type { PaymentMethod, Sale, SaleLine } from "../types/pos";
import { ReceiptDetailPanel } from "./receipt-detail-panel";
import { PosReceiptReprintModal } from "./pos-receipt-reprint-modal";
import { PosReturnModal } from "./pos-return-modal";

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  mobile_money: "Mobile money",
  bank: "Bank",
  other: "Other",
};

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

const WRAP_TEXT_COLS: HistoryColumnId[] = ["description", "productNotes"];

function truncate(s: string, max: number) {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function correlationId(prefix: string) {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `${prefix}_${crypto.randomUUID()}`
    : `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function paymentsSummary(sale: Sale): string {
  if (sale.payments.length === 0) return "—";
  return sale.payments
    .map((p) => `${PAYMENT_LABELS[p.method] ?? p.method} ${money(p.amount)}`)
    .join(" · ");
}

function cellValue(
  col: HistoryColumnId,
  sale: Sale,
  line: SaleLine,
  catalog: ProductReadModel | null,
): string {
  switch (col) {
    case "receiptNumber":
      return sale.receiptNumber;
    case "saleDate":
      return formatWhen(sale.createdAt);
    case "saleStatus":
      return sale.status;
    case "saleBranchId":
      return sale.branchId;
    case "surface":
      return sale.surface ?? "—";
    case "deliveryFee":
      return money(sale.deliveryFee);
    case "amountDue":
      return money(sale.amountDue);
    case "salesTaxAmount":
      return sale.salesTaxAmount != null ? money(sale.salesTaxAmount) : "—";
    case "totalPaid":
      return money(sale.totalPaid);
    case "changeDue":
      return money(sale.changeDue);
    case "ideliverProviderName":
      return sale.ideliverProviderName?.trim() ? sale.ideliverProviderName : "—";
    case "paymentsSummary":
      return paymentsSummary(sale);
    case "sku":
      return line.sku;
    case "name":
      return line.name;
    case "unit":
      return line.unit;
    case "qty":
      return String(line.qty);
    case "unitPrice":
      return money(line.unitPrice);
    case "lineTotal":
      return money(line.lineTotal);
    case "lineTaxable":
      return line.taxable === false ? "No" : "Yes";
    case "productId":
      return line.productId;
    case "sectorLabel":
      return catalog?.sectorLabel ?? "—";
    case "sectorId":
      return catalog?.sectorId ?? "—";
    case "inventoryType":
      return catalog ? labelForInventoryItemType(catalog.inventoryType) : "—";
    case "locDepartment":
      return catalog?.locDepartment?.trim() ? catalog.locDepartment : "—";
    case "locShelf":
      return catalog?.locShelf?.trim() ? catalog.locShelf : "—";
    case "locSite":
      return catalog?.locSite?.trim() ? catalog.locSite : "—";
    case "barcode":
      return catalog?.barcode?.trim() ? catalog.barcode : "—";
    case "upc":
      return catalog?.upc?.trim() ? catalog.upc : "—";
    case "brand":
      return catalog?.brand?.trim() ? catalog.brand : "—";
    case "description":
      return catalog?.description?.trim() ? truncate(catalog.description, 120) : "—";
    case "productNotes":
      return catalog?.productNotes?.trim() ? truncate(catalog.productNotes, 120) : "—";
    case "currentSellingPrice":
      return catalog ? money(catalog.sellingPrice) : "—";
    case "onHandQty":
      return catalog != null ? String(catalog.onHandQty) : "—";
    case "catalogBranchId":
      return catalog?.branchId ?? "—";
    case "active":
      return catalog != null ? (catalog.active ? "Yes" : "No") : "—";
    case "forSale":
      return catalog != null ? (catalog.forSale ? "Yes" : "No") : "—";
    case "reorderQty":
      return catalog != null ? String(catalog.reorderQty) : "—";
    case "alternativeProductId":
      return catalog?.alternativeProductId?.trim() ? catalog.alternativeProductId : "—";
    case "flagExternalIdeliver":
      return catalog != null ? (catalog.flagExternalIdeliver ? "Yes" : "No") : "—";
    default:
      return "—";
  }
}

export type PosSalesHistoryTabProps = {
  refreshTrigger?: number;
  catalogTick?: number;
  pinnedSale?: Sale | null;
  onDismissPin?: () => void;
};

export function PosSalesHistoryTab({
  refreshTrigger = 0,
  catalogTick = 0,
  pinnedSale = null,
  onDismissPin,
}: PosSalesHistoryTabProps) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [visible, setVisible] = useState<Set<HistoryColumnId>>(() => defaultHistoryColumns());
  const [reprintSale, setReprintSale] = useState<Sale | null>(null);
  const [voiding, setVoiding] = useState(false);
  const [voidMsg, setVoidMsg] = useState<string | null>(null);
  const [reprintMsg, setReprintMsg] = useState<string | null>(null);
  const [returnSale, setReturnSale] = useState<Sale | null>(null);

  const refresh = useCallback(() => {
    setSales(listSales());
  }, []);

  useEffect(() => {
    setVisible(loadHistoryColumnVisibility());
  }, []);

  useEffect(() => {
    refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === posSalesStorageKey()) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh, refreshTrigger]);

  const rows = useMemo(() => {
    void catalogTick;
    const out: { sale: Sale; line: SaleLine; catalog: ProductReadModel | null }[] = [];
    for (const sale of sales) {
      for (const line of sale.lines) {
        out.push({
          sale,
          line,
          catalog: getProductReadModel(line.productId) ?? null,
        });
      }
    }
    return out;
  }, [sales, catalogTick]);

  const orderedCols = useMemo(
    () => HISTORY_COLUMN_DEFS.filter((d) => visible.has(d.id)),
    [visible],
  );

  function toggleColumn(id: HistoryColumnId) {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size <= 1) return prev;
        next.delete(id);
      } else {
        next.add(id);
      }
      saveHistoryColumnVisibility(next);
      return next;
    });
  }

  function resetColumns() {
    const next = defaultHistoryColumns();
    setVisible(next);
    saveHistoryColumnVisibility(next);
  }

  const groups = [
    { title: "Receipt & totals", key: "sale" as const },
    { title: "Line", key: "line" as const },
    { title: "Catalog (current)", key: "catalog" as const },
  ];

  return (
    <div className="flex min-h-[min(72vh,640px)] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Sales History</h2>
          <p className="pos-data-log-muted mt-0.5 text-xs">
            One row per line · click a row for 80-column reprint preview · {rows.length} row
            {rows.length === 1 ? "" : "s"} · {posSalesStorageKey()}
          </p>
        </div>
        <details className="relative">
          <summary className="vc-btn-secondary cursor-pointer list-none rounded-lg px-3 py-2 text-sm [&::-webkit-details-marker]:hidden">
            Columns
          </summary>
          <div className="absolute right-0 z-20 mt-2 w-[min(100vw-2rem,22rem)] rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-lg">
            <p className="pos-data-log-muted mb-2 text-[11px] leading-snug">
              Cost and supplier fields are not available here. At least one column must stay visible.
            </p>
            <div className="max-h-[min(60vh,320px)] space-y-3 overflow-y-auto pr-1">
              {groups.map((g) => (
                <div key={g.key}>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{g.title}</p>
                  <ul className="space-y-1.5">
                    {HISTORY_COLUMN_DEFS.filter((d) => d.group === g.key).map((d) => (
                      <li key={d.id}>
                        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-800">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 accent-teal-600"
                            checked={visible.has(d.id)}
                            onChange={() => toggleColumn(d.id)}
                          />
                          {d.label}
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <button type="button" className="mt-3 text-xs font-semibold text-teal-700 hover:underline" onClick={resetColumns}>
              Reset to defaults
            </button>
          </div>
        </details>
      </div>

      {pinnedSale ? (
        <div className="space-y-2">
          <ReceiptDetailPanel
            sale={pinnedSale}
            meta={receiptMetaForLocalSale(pinnedSale)}
            title="Latest receipt"
            onDismiss={onDismissPin}
            dismissLabel="Dismiss"
          />
          {pinnedSale.status === "completed" ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:border-teal-500"
                onClick={() => setReturnSale(pinnedSale)}
              >
                Return items
              </button>
              <button
                type="button"
                disabled={voiding}
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800 hover:border-rose-300 disabled:opacity-60"
                onClick={() => {
                  if (voiding) return;
                  void (async () => {
                    setVoidMsg(null);
                    const reason = window.prompt("Void reason (required).", "");
                    if (reason == null) return;
                    const trimmed = reason.trim();
                    if (!trimmed) {
                      setVoidMsg("Void reason is required.");
                      return;
                    }

                    setVoiding(true);
                    try {
                      const auth = await authzCheck("pos.sale.void", {
                        scopeEntityType: "desk",
                        scopeCode: "pos_desk",
                        criticalReason: `Void sale ${pinnedSale.receiptNumber} (${pinnedSale.id})`,
                      });
                      if (!auth.allowed) {
                        setVoidMsg(auth.reasonMessage);
                        return;
                      }

                      const r = voidSale({ saleId: pinnedSale.id, reason: trimmed, actorLabel: "Desktop POS" });
                      if (!r.ok) {
                        setVoidMsg(r.error);
                        return;
                      }

                      const corr = correlationId("pos_void");
                      appendDeskAuditEvent({
                        sourceKind: "pos",
                        sourceId: "desktop_pos",
                        action: "pos.receipt.voided.requested",
                        actorLabel: "Desktop POS",
                        notes: trimmed,
                        moduleKey: "pos",
                        entityType: "sale",
                        entityId: pinnedSale.id,
                        correlationId: corr,
                        beforeState: { receiptNumber: pinnedSale.receiptNumber, status: pinnedSale.status },
                        afterState: { status: "voided" },
                      });
                      void emitPosSaleVoidedBrainEventDurable({ sale: r.sale, correlationId: corr, reason: trimmed });

                      refresh();
                      onDismissPin?.();
                      setVoidMsg("Sale voided.");
                      setTimeout(() => setVoidMsg(null), 2500);
                    } finally {
                      setVoiding(false);
                    }
                  })();
                }}
              >
                Void this sale
              </button>
              <p className="text-[11px] text-slate-500">
                Restores stock and removes local ledger effects (COGS, tax, delivery credit).
              </p>
              {voidMsg ? <p className="w-full text-[11px] font-semibold text-rose-700">{voidMsg}</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {reprintSale ? <PosReceiptReprintModal sale={reprintSale} onClose={() => setReprintSale(null)} /> : null}
      {returnSale ? (
        <PosReturnModal
          sale={returnSale}
          onClose={() => setReturnSale(null)}
          onReturned={() => {
            refresh();
          }}
        />
      ) : null}
      {reprintMsg ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
          {reprintMsg}
        </p>
      ) : null}

      <div className="vc-table-shell min-h-0 flex-1">
        <div className="max-h-[min(60vh,560px)] overflow-auto">
          <table className="min-w-[720px] w-full border-collapse text-left text-xs">
            <thead className="vc-table-head sticky top-0 z-10">
              <tr>
                {orderedCols.map((c) => (
                  <th key={c.id} className="whitespace-nowrap px-3 py-2 font-semibold">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white text-[#36454f]">
              {rows.length === 0 ? (
                <tr>
                  <td className="px-3 py-8 text-center text-sm text-slate-600" colSpan={Math.max(orderedCols.length, 1)}>
                    No completed sales yet.
                  </td>
                </tr>
              ) : (
                rows.map(({ sale, line, catalog }, idx) => (
                  <tr
                    key={`${sale.id}-${line.productId}-${idx}`}
                    role="button"
                    tabIndex={0}
                    className="cursor-pointer hover:bg-teal-50/80"
                    onClick={() => {
                      void (async () => {
                        setReprintMsg(null);
                        const auth = await authzCheck("pos.receipt.reprint", {
                          scopeEntityType: "desk",
                          scopeCode: "pos_desk",
                          criticalReason: `Reprint receipt ${sale.receiptNumber} (${sale.id})`,
                        });
                        if (!auth.allowed) {
                          setReprintMsg(auth.reasonMessage);
                          setTimeout(() => setReprintMsg(null), 4500);
                          return;
                        }
                        const reason = window.prompt("Reprint reason (required).", "") ?? "";
                        const trimmed = reason.trim();
                        if (!trimmed) {
                          setReprintMsg("Reprint reason is required.");
                          setTimeout(() => setReprintMsg(null), 4500);
                          return;
                        }
                        const corr = correlationId("pos_reprint");
                        appendDeskAuditEvent({
                          sourceKind: "pos",
                          sourceId: "desktop_pos",
                          action: "pos.receipt.reprinted",
                          actorLabel: "Desktop POS",
                          notes: trimmed,
                          moduleKey: "pos",
                          entityType: "receipt",
                          entityId: sale.receiptNumber,
                          correlationId: corr,
                          afterState: { saleId: sale.id, receiptNumber: sale.receiptNumber },
                        });
                        void emitPosReceiptReprintedBrainEventDurable({ sale, correlationId: corr, reason: trimmed });
                        setReprintSale(sale);
                      })();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        void (async () => {
                          setReprintMsg(null);
                          const auth = await authzCheck("pos.receipt.reprint", {
                            scopeEntityType: "desk",
                            scopeCode: "pos_desk",
                            criticalReason: `Reprint receipt ${sale.receiptNumber} (${sale.id})`,
                          });
                          if (!auth.allowed) {
                            setReprintMsg(auth.reasonMessage);
                            setTimeout(() => setReprintMsg(null), 4500);
                            return;
                          }
                          const reason = window.prompt("Reprint reason (required).", "") ?? "";
                          const trimmed = reason.trim();
                          if (!trimmed) {
                            setReprintMsg("Reprint reason is required.");
                            setTimeout(() => setReprintMsg(null), 4500);
                            return;
                          }
                          const corr = correlationId("pos_reprint");
                          appendDeskAuditEvent({
                            sourceKind: "pos",
                            sourceId: "desktop_pos",
                            action: "pos.receipt.reprinted",
                            actorLabel: "Desktop POS",
                            notes: trimmed,
                            moduleKey: "pos",
                            entityType: "receipt",
                            entityId: sale.receiptNumber,
                            correlationId: corr,
                            afterState: { saleId: sale.id, receiptNumber: sale.receiptNumber },
                          });
                          void emitPosReceiptReprintedBrainEventDurable({ sale, correlationId: corr, reason: trimmed });
                          setReprintSale(sale);
                        })();
                      }
                    }}
                  >
                    {orderedCols.map((c) => (
                      <td
                        key={c.id}
                        className={
                          WRAP_TEXT_COLS.includes(c.id)
                            ? "max-w-[16rem] whitespace-normal break-words px-3 py-2 font-medium"
                            : "whitespace-nowrap px-3 py-2 font-medium"
                        }
                      >
                        {cellValue(c.id, sale, line, catalog)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
