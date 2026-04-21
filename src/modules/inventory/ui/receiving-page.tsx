"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DashboardTopBar } from "@/components/dashboard/dashboard-top-bar";
import type { Id, PurchaseOrder } from "../types/models";
import { InventoryRepo } from "../services/inventory-repo";
import { PurchasingService } from "../services/purchasing-service";
import { ReceivingService } from "../services/receiving-service";
import {
  buildReceivingVoucherContext,
  buildReceivingVoucherHtml,
  buildReceivingVoucherPlainText,
  openReceivingVoucherPrint,
  telegramShareUrl,
  voucherRefFromReceipt,
  whatsAppShareUrl,
  type ReceivingVoucherContext,
} from "../services/receiving-voucher";

type Row = { productId: Id; receivedQty: number; unitCost: number };

function isOutstandingPo(po: PurchaseOrder): boolean {
  return (
    (po.status === "ordered" || po.status === "partially_received") &&
    po.items.length > 0
  );
}

export function ReceivingPage() {
  const router = useRouter();
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [selectedPoId, setSelectedPoId] = useState<Id>("");
  const [rows, setRows] = useState<Row[]>([]);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [receiptTick, setReceiptTick] = useState(0);
  const [receiveBranchId, setReceiveBranchId] = useState<Id>("");
  const [voucherCtx, setVoucherCtx] = useState<ReceivingVoucherContext | null>(null);

  const branches = useMemo(() => InventoryRepo.listBranches(), []);

  function refresh() {
    setPos(PurchasingService.listPurchaseOrders());
    setReceiptTick((t) => t + 1);
  }

  useEffect(() => {
    refresh();
  }, []);

  const outstandingPos = useMemo(() => pos.filter(isOutstandingPo), [pos]);

  const selectedPo = useMemo(
    () => (selectedPoId ? PurchasingService.getPurchaseOrder(selectedPoId) : undefined),
    [selectedPoId, pos],
  );

  useEffect(() => {
    if (selectedPoId && !outstandingPos.some((p) => p.id === selectedPoId)) {
      setSelectedPoId("");
    }
  }, [outstandingPos, selectedPoId]);

  const receivedMap = useMemo(() => {
    void receiptTick;
    return selectedPoId ? ReceivingService.getReceivedQtyByProductForPo(selectedPoId) : new Map<Id, number>();
  }, [selectedPoId, receiptTick]);

  useEffect(() => {
    if (!selectedPoId) {
      setRows([]);
      setReceiveBranchId("");
      return;
    }
    const po = PurchasingService.getPurchaseOrder(selectedPoId);
    if (!po || !isOutstandingPo(po)) {
      setRows([]);
      setReceiveBranchId("");
      return;
    }
    setReceiveBranchId(po.branchId);
    setRows(
      po.items.map((it) => ({
        productId: it.productId,
        receivedQty: 0,
        unitCost: it.expectedUnitCost,
      })),
    );
  }, [selectedPoId, receiptTick]);

  function updateRow(productId: Id, patch: Partial<Row>) {
    setRows((prev: Row[]) =>
      prev.map((r: Row) => (r.productId === productId ? { ...r, ...patch } : r)),
    );
  }

  return (
    <>
      <DashboardTopBar title="Receiving" subtitle="Receive goods against a purchase order and update local stock." />
      <div className="flex-1 space-y-8 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/dashboard/inventory" className="text-sm font-semibold text-teal-600 hover:underline">
            ← Back to inventory
          </Link>
          <Link href="/dashboard/inventory/purchasing" className="text-sm font-semibold text-neutral-200 hover:text-white">
            Go to purchasing →
          </Link>
        </div>

        <section className="vendor-panel rounded-2xl p-6">
          <h2 className="text-base font-semibold text-white">Outstanding orders</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Only <span className="text-neutral-200">ordered</span> and{" "}
            <span className="text-neutral-200">partially received</span> POs appear here. Fully received POs are
            hidden.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-neutral-200" htmlFor="po">
                Purchase order
              </label>
              <select
                id="po"
                value={selectedPoId}
                onChange={(e) => setSelectedPoId(e.target.value)}
                aria-label="Select purchase order"
                className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Select…</option>
                {outstandingPos.map((po: PurchaseOrder) => {
                  const s = InventoryRepo.getSupplier(po.supplierId);
                  const statusLabel =
                    po.status === "partially_received" ? "partial" : po.status;
                  return (
                    <option key={po.id} value={po.id}>
                      {(s?.name ?? "Supplier")} · {statusLabel} · {po.reference ?? po.id}
                    </option>
                  );
                })}
              </select>
              <p className="mt-1 text-xs text-neutral-400">
                Tip: create and mark a PO ordered in Purchasing first. Partial receipts stay in this list until fully
                received.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-200" htmlFor="warehouse">
                Receive into (warehouse / shop)
              </label>
              <select
                id="warehouse"
                value={receiveBranchId}
                onChange={(e) => setReceiveBranchId(e.target.value)}
                disabled={!selectedPoId}
                aria-label="Warehouse or shop receiving stock"
                className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm disabled:opacity-50"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.isDefault ? " (default)" : ""}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-neutral-400">
                Stock and the receiving voucher reference this location. Defaults to the PO branch; change if goods arrive
                elsewhere.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-200" htmlFor="notes">
                Notes (optional)
              </label>
              <input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                placeholder="e.g. Delivery note 123"
              />
            </div>
          </div>
        </section>

        {message ? (
          <div className="vendor-panel-soft rounded-xl px-4 py-3 text-sm text-neutral-200">{message}</div>
        ) : null}

        <section className="vendor-panel rounded-2xl p-6">
          <h2 className="text-base font-semibold text-white">Receive items</h2>
          {!selectedPo ? (
            <p className="mt-3 text-sm text-neutral-300">Select a purchase order to load its items.</p>
          ) : selectedPo.items.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-300">This PO has no items.</p>
          ) : (
            <>
              <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/[0.06] text-neutral-200">
                    <tr>
                      <th className="px-4 py-3 font-medium">Product</th>
                      <th className="px-4 py-3 font-medium">Ordered</th>
                      <th className="px-4 py-3 font-medium">Received</th>
                      <th className="px-4 py-3 font-medium">Open</th>
                      <th className="px-4 py-3 font-medium">Receive now</th>
                      <th className="px-4 py-3 font-medium">Unit cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {selectedPo.items.map((it) => {
                      const p = InventoryRepo.getProduct(it.productId);
                      const r = rows.find((x: Row) => x.productId === it.productId);
                      const already = receivedMap.get(it.productId) ?? 0;
                      const open = Math.max(0, it.orderedQty - already);
                      return (
                        <tr key={it.id} className="bg-white/[0.03] hover:bg-white/[0.06]">
                          <td className="px-4 py-3">
                            <p className="text-white">{p?.name ?? "Unknown product"}</p>
                            <p className="text-xs text-neutral-400">{p?.sku ?? it.productId}</p>
                          </td>
                          <td className="px-4 py-3 text-neutral-200">{it.orderedQty}</td>
                          <td className="px-4 py-3 text-neutral-300">{already}</td>
                          <td className="px-4 py-3 font-medium text-amber-200/90">{open}</td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min={0}
                              max={open}
                              step={1}
                              value={r?.receivedQty ?? ""}
                              aria-label={`Receive quantity for ${p?.name ?? "product"}`}
                              title="Receive quantity (cannot exceed open qty)"
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === "") {
                                  updateRow(it.productId, { receivedQty: 0 });
                                  return;
                                }
                                const n = Number(v);
                                if (!Number.isFinite(n)) return;
                                const q = Math.max(0, Math.min(Math.floor(n), open));
                                updateRow(it.productId, { receivedQty: q });
                              }}
                              className="vendor-field w-28 rounded-lg px-2 py-1.5 text-sm"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={r?.unitCost ?? it.expectedUnitCost}
                              aria-label={`Received unit cost for ${p?.name ?? "product"}`}
                              title="Received unit cost"
                              onChange={(e) => updateRow(it.productId, { unitCost: Number(e.target.value) })}
                              className="vendor-field w-32 rounded-lg px-2 py-1.5 text-sm"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedPo) return;
                    if (!receiveBranchId) {
                      setMessage("Select a warehouse / shop to receive into.");
                      setTimeout(() => setMessage(null), 5000);
                      return;
                    }
                    try {
                      const receipt = ReceivingService.receiveAgainstPurchaseOrder({
                        purchaseOrderId: selectedPo.id,
                        branchId: receiveBranchId,
                        notes: notes.trim() || undefined,
                        items: rows.map((r: Row) => ({
                          productId: r.productId,
                          receivedQty: r.receivedQty,
                          unitCost: r.unitCost,
                        })),
                      });
                      setNotes("");
                      refresh();
                      setVoucherCtx(buildReceivingVoucherContext(receipt, selectedPo));
                    } catch (e) {
                      setMessage(e instanceof Error ? e.message : "Failed to receive.");
                      setTimeout(() => setMessage(null), 5000);
                    }
                  }}
                  className="rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
                >
                  Save receipt + update stock
                </button>
              </div>
            </>
          )}
        </section>

        {voucherCtx ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-2xl border border-white/10 bg-neutral-950 shadow-xl">
              <div className="border-b border-white/10 px-5 py-4">
                <h3 className="text-lg font-semibold text-white">Receiving voucher</h3>
                <p className="mt-1 text-sm text-neutral-400">
                  {voucherRefFromReceipt(voucherCtx.receipt)} · Stock updated for{" "}
                  <span className="text-neutral-200">{voucherCtx.branchName}</span>
                </p>
              </div>
              <iframe
                title="Receiving voucher preview"
                className="min-h-[320px] flex-1 w-full rounded-none border-0 bg-white"
                srcDoc={buildReceivingVoucherHtml(voucherCtx)}
              />
              <div className="flex flex-wrap gap-2 border-t border-white/10 px-5 py-4">
                <button
                  type="button"
                  className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
                  onClick={() => openReceivingVoucherPrint(voucherCtx)}
                >
                  Print / Save as PDF
                </button>
                <a
                  className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-neutral-100 hover:bg-white/5"
                  href={whatsAppShareUrl(buildReceivingVoucherPlainText(voucherCtx))}
                  target="_blank"
                  rel="noreferrer"
                >
                  Share via WhatsApp
                </a>
                <a
                  className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-neutral-100 hover:bg-white/5"
                  href={telegramShareUrl(buildReceivingVoucherPlainText(voucherCtx))}
                  target="_blank"
                  rel="noreferrer"
                >
                  Share via Telegram
                </a>
                <button
                  type="button"
                  className="ml-auto rounded-lg border border-white/15 px-4 py-2 text-sm text-neutral-300 hover:bg-white/5"
                  onClick={() => {
                    setVoucherCtx(null);
                    router.push("/dashboard/inventory");
                  }}
                >
                  Done — back to inventory
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-white/15 px-4 py-2 text-sm text-neutral-400 hover:bg-white/5"
                  onClick={() => setVoucherCtx(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
