"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DashboardTopBar } from "@/components/dashboard/dashboard-top-bar";
import type { Id, PurchaseOrder } from "../types/models";
import { InventoryRepo } from "../services/inventory-repo";
import { PurchasingService } from "../services/purchasing-service";
import { ReceivingService } from "../services/receiving-service";

type Row = { productId: Id; receivedQty: number; unitCost: number };

export function ReceivingPage() {
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [selectedPoId, setSelectedPoId] = useState<Id>("");
  const [rows, setRows] = useState<Row[]>([]);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  function refresh() {
    setPos(PurchasingService.listPurchaseOrders());
  }

  useEffect(() => {
    refresh();
  }, []);

  const selectedPo = useMemo(
    () => (selectedPoId ? PurchasingService.getPurchaseOrder(selectedPoId) : undefined),
    [selectedPoId, pos],
  );

  useEffect(() => {
    if (!selectedPo) {
      setRows([]);
      return;
    }
    setRows(
      selectedPo.items.map((it) => ({
        productId: it.productId,
        receivedQty: 0,
        unitCost: it.expectedUnitCost,
      })),
    );
  }, [selectedPo]);

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
          <Link href="/dashboard/inventory" className="text-sm font-semibold text-brand-orange hover:underline">
            ← Back to inventory
          </Link>
          <Link href="/dashboard/inventory/purchasing" className="text-sm font-semibold text-neutral-200 hover:text-white">
            Go to purchasing →
          </Link>
        </div>

        <section className="vendor-panel rounded-2xl p-6">
          <h2 className="text-base font-semibold text-white">Select purchase order</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
                {pos.map((po: PurchaseOrder) => {
                  const s = InventoryRepo.getSupplier(po.supplierId);
                  return (
                    <option key={po.id} value={po.id}>
                      {(s?.name ?? "Supplier")} · {po.status} · {po.reference ?? po.id}
                    </option>
                  );
                })}
              </select>
              <p className="mt-1 text-xs text-neutral-400">
                Tip: create a PO in purchasing first, then come here to receive against it.
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
          <div className="vendor-panel-soft rounded-xl px-4 py-3 text-sm text-neutral-200">
            {message}
          </div>
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
                      <th className="px-4 py-3 font-medium">Receive now</th>
                      <th className="px-4 py-3 font-medium">Unit cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {selectedPo.items.map((it) => {
                      const p = InventoryRepo.getProduct(it.productId);
                      const r = rows.find((x: Row) => x.productId === it.productId);
                      return (
                        <tr key={it.id} className="bg-white/[0.03] hover:bg-white/[0.06]">
                          <td className="px-4 py-3">
                            <p className="text-white">{p?.name ?? "Unknown product"}</p>
                            <p className="text-xs text-neutral-400">{p?.sku ?? it.productId}</p>
                          </td>
                          <td className="px-4 py-3 text-neutral-200">{it.orderedQty}</td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={r?.receivedQty ?? 0}
                              aria-label={`Receive quantity for ${p?.name ?? "product"}`}
                              title="Receive quantity"
                              onChange={(e) => updateRow(it.productId, { receivedQty: Number(e.target.value) })}
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
                    try {
                      ReceivingService.receiveAgainstPurchaseOrder({
                        purchaseOrderId: selectedPo.id,
                        notes: notes.trim() || undefined,
                        items: rows.map((r: Row) => ({
                          productId: r.productId,
                          receivedQty: r.receivedQty,
                          unitCost: r.unitCost,
                        })),
                      });
                      setMessage("Receipt saved and stock updated locally.");
                      setNotes("");
                      setRows((prev: Row[]) => prev.map((x: Row) => ({ ...x, receivedQty: 0 })));
                      refresh();
                      setTimeout(() => setMessage(null), 2000);
                    } catch (e) {
                      setMessage(e instanceof Error ? e.message : "Failed to receive.");
                    }
                  }}
                  className="rounded-lg bg-brand-orange px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-orange-hover"
                >
                  Save receipt + update stock
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
