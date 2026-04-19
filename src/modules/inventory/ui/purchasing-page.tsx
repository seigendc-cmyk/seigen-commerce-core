"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DashboardTopBar } from "@/components/dashboard/dashboard-top-bar";
import type { Id, PurchaseOrder, Supplier } from "../types/models";
import { InventoryRepo } from "../services/inventory-repo";
import { listProductReadModels } from "../services/product-read-model";
import { PurchasingService } from "../services/purchasing-service";

function money(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function PurchasingPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [productsVersion, setProductsVersion] = useState(0);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [activePoId, setActivePoId] = useState<Id | null>(null);

  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierPhone, setNewSupplierPhone] = useState("");

  const [poSupplierId, setPoSupplierId] = useState<Id>("");
  const [poReference, setPoReference] = useState("");

  const [addItemProductId, setAddItemProductId] = useState<Id>("");

  function refresh() {
    setSuppliers(InventoryRepo.listSuppliers());
    setPos(PurchasingService.listPurchaseOrders());
    setProductsVersion((v) => v + 1);
  }

  useEffect(() => {
    refresh();
  }, []);

  const products = useMemo(() => {
    void productsVersion;
    return listProductReadModels();
  }, [productsVersion]);

  const activePo = useMemo(
    () => (activePoId ? PurchasingService.getPurchaseOrder(activePoId) : undefined),
    [activePoId, pos],
  );

  const activeSupplier = useMemo(
    () => (activePo ? InventoryRepo.getSupplier(activePo.supplierId) : undefined),
    [activePo, suppliers],
  );

  const totals = useMemo(() => {
    if (!activePo) return { lines: 0, qty: 0, total: 0 };
    const lines = activePo.items.length;
    let qty = 0;
    let total = 0;
    for (const it of activePo.items) {
      qty += it.orderedQty;
      total += it.orderedQty * it.expectedUnitCost;
    }
    return { lines, qty, total };
  }, [activePo]);

  return (
    <>
      <DashboardTopBar title="Purchasing" subtitle="Create local purchase orders and add items with expected cost." />
      <div className="flex-1 space-y-8 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/dashboard/inventory" className="text-sm font-semibold text-brand-orange hover:underline">
            ← Back to inventory
          </Link>
          <Link
            href="/dashboard/inventory/receiving"
            className="text-sm font-semibold text-neutral-200 hover:text-white"
          >
            Go to receiving →
          </Link>
        </div>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-1">
            <div className="vendor-panel rounded-2xl p-6">
              <h2 className="text-base font-semibold text-white">Suppliers</h2>
              <p className="mt-1 text-sm text-neutral-300">Add a supplier locally for purchase orders.</p>
              <div className="mt-4 space-y-3">
                <input
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  placeholder="Supplier name"
                  className="vendor-field w-full rounded-lg px-3 py-2 text-sm"
                />
                <input
                  value={newSupplierPhone}
                  onChange={(e) => setNewSupplierPhone(e.target.value)}
                  placeholder="Phone (optional)"
                  className="vendor-field w-full rounded-lg px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={!newSupplierName.trim()}
                  onClick={() => {
                    InventoryRepo.addSupplier({
                      name: newSupplierName.trim(),
                      phone: newSupplierPhone.trim() || undefined,
                    });
                    setNewSupplierName("");
                    setNewSupplierPhone("");
                    refresh();
                  }}
                  className="w-full rounded-lg bg-brand-orange px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-orange-hover disabled:opacity-50"
                >
                  Add supplier
                </button>
              </div>

              <div className="mt-5 space-y-2">
                {suppliers.length === 0 ? (
                  <p className="text-sm text-neutral-300">No suppliers yet.</p>
                ) : (
                  suppliers.map((s) => (
                    <div key={s.id} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2">
                      <p className="text-sm font-medium text-white">{s.name}</p>
                      <p className="text-xs text-neutral-400">{s.phone ?? "—"}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="vendor-panel rounded-2xl p-6">
              <h2 className="text-base font-semibold text-white">Create purchase order</h2>
              <div className="mt-4 space-y-3">
                <select
                  value={poSupplierId}
                  onChange={(e) => setPoSupplierId(e.target.value)}
                  aria-label="Select supplier for new purchase order"
                  title="Supplier"
                  className="vendor-field w-full rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select supplier…</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <input
                  value={poReference}
                  onChange={(e) => setPoReference(e.target.value)}
                  placeholder="Reference (optional)"
                  className="vendor-field w-full rounded-lg px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={!poSupplierId}
                  onClick={() => {
                    const po = PurchasingService.createPurchaseOrder({
                      supplierId: poSupplierId,
                      reference: poReference.trim() || undefined,
                    });
                    setPoReference("");
                    refresh();
                    setActivePoId(po.id);
                  }}
                  className="w-full rounded-lg bg-brand-orange px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-orange-hover disabled:opacity-50"
                >
                  Create PO
                </button>
              </div>
            </div>

            <div className="vendor-panel rounded-2xl p-6">
              <h2 className="text-base font-semibold text-white">Purchase orders</h2>
              <div className="mt-4 space-y-2">
                {pos.length === 0 ? (
                  <p className="text-sm text-neutral-300">No purchase orders yet.</p>
                ) : (
                  pos.map((po) => {
                    const s = InventoryRepo.getSupplier(po.supplierId);
                    const active = po.id === activePoId;
                    return (
                      <button
                        key={po.id}
                        type="button"
                        onClick={() => setActivePoId(po.id)}
                        className={[
                          "w-full rounded-xl border px-3 py-2 text-left transition-colors",
                          active
                            ? "border-brand-orange/50 bg-white/10"
                            : "border-white/10 bg-white/[0.04] hover:border-white/20",
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-white">{s?.name ?? "Unknown supplier"}</p>
                          <p className="text-xs text-neutral-400">{po.status}</p>
                        </div>
                        <p className="text-xs text-neutral-400">{po.reference ? `Ref: ${po.reference}` : po.id}</p>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6 lg:col-span-2">
            <div className="vendor-panel rounded-2xl p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-white">PO details</h2>
                  <p className="mt-1 text-sm text-neutral-300">
                    {activePo ? `Supplier: ${activeSupplier?.name ?? "—"}` : "Select a PO to edit items."}
                  </p>
                </div>
                {activePo ? (
                  <div className="rounded-lg border border-white/18 bg-[var(--vendor-field-bg)] px-3 py-2 text-right">
                    <p className="text-xs text-neutral-400">Est. total</p>
                    <p className="text-sm font-semibold text-white">{money(totals.total)}</p>
                  </div>
                ) : null}
              </div>

              {!activePo ? (
                <p className="mt-6 text-sm text-neutral-300">No active purchase order selected.</p>
              ) : (
                <>
                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-neutral-200" htmlFor="add-item">
                        Add item
                      </label>
                      <select
                        id="add-item"
                        value={addItemProductId}
                        onChange={(e) => setAddItemProductId(e.target.value)}
                        aria-label="Select product to add to purchase order"
                        title="Product"
                        className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="">Select product…</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.sku} · {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        disabled={!addItemProductId}
                        onClick={() => {
                          PurchasingService.addItem(activePo.id, addItemProductId);
                          setAddItemProductId("");
                          refresh();
                        }}
                        className="w-full rounded-lg bg-brand-orange px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-orange-hover disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {activePo.items.length === 0 ? (
                    <p className="mt-6 text-sm text-neutral-300">
                      Add products to this PO. You can set ordered quantities and expected unit cost.
                    </p>
                  ) : (
                    <div className="mt-6 overflow-hidden rounded-xl border border-white/10">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-white/[0.06] text-neutral-200">
                          <tr>
                            <th className="px-4 py-3 font-medium">Product</th>
                            <th className="px-4 py-3 font-medium">Qty</th>
                            <th className="px-4 py-3 font-medium">Unit cost</th>
                            <th className="px-4 py-3 font-medium">Line</th>
                            <th className="px-4 py-3 font-medium"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                          {activePo.items.map((it) => {
                            const p = InventoryRepo.getProduct(it.productId);
                            const line = it.orderedQty * it.expectedUnitCost;
                            return (
                              <tr key={it.id} className="bg-white/[0.03] hover:bg-white/[0.06]">
                                <td className="px-4 py-3">
                                  <p className="text-white">{p?.name ?? "Unknown product"}</p>
                                  <p className="text-xs text-neutral-400">{p?.sku ?? it.productId}</p>
                                </td>
                                <td className="px-4 py-3">
                                  <input
                                    type="number"
                                    min={0}
                                    step={1}
                                    value={it.orderedQty}
                                    aria-label={`Ordered quantity for ${p?.name ?? "product"}`}
                                    title="Ordered quantity"
                                    placeholder="0"
                                    onChange={(e) =>
                                      PurchasingService.updateItem(activePo.id, it.id, {
                                        orderedQty: Number(e.target.value),
                                      })
                                    }
                                    onBlur={refresh}
                                    className="vendor-field w-24 rounded-lg px-2 py-1.5 text-sm"
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <input
                                    type="number"
                                    min={0}
                                    step="any"
                                    value={it.expectedUnitCost}
                                    aria-label={`Expected unit cost for ${p?.name ?? "product"}`}
                                    title="Expected unit cost"
                                    placeholder="0.00"
                                    onChange={(e) =>
                                      PurchasingService.updateItem(activePo.id, it.id, {
                                        expectedUnitCost: Number(e.target.value),
                                      })
                                    }
                                    onBlur={refresh}
                                    className="vendor-field w-28 rounded-lg px-2 py-1.5 text-sm"
                                  />
                                </td>
                                <td className="px-4 py-3 text-neutral-200">{money(line)}</td>
                                <td className="px-4 py-3">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      PurchasingService.removeItem(activePo.id, it.id);
                                      refresh();
                                    }}
                                    className="text-sm font-semibold text-neutral-300 hover:text-white"
                                  >
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-neutral-300">
                      Lines: <span className="text-neutral-200">{totals.lines}</span> · Qty:{" "}
                      <span className="text-neutral-200">{totals.qty}</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        PurchasingService.setStatus(activePo.id, "ordered");
                        refresh();
                      }}
                      className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:border-brand-orange hover:text-brand-orange"
                    >
                      Mark ordered
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="vendor-panel-soft rounded-2xl p-6">
              <h2 className="text-base font-semibold text-white">Notes</h2>
              <p className="mt-2 text-sm text-neutral-300">
                Purchasing is fully local. Receiving uses the PO items and updates stock records.
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
