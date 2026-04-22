"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DashboardTopBar } from "@/components/dashboard/dashboard-top-bar";
import type { Id, PurchaseOrder, PurchasePaymentTerms, Supplier } from "../types/models";
import { InventoryRepo } from "../services/inventory-repo";
import { listProductReadModels } from "../services/product-read-model";
import { defaultExpectedUnitCostFromProduct, PurchasingService } from "../services/purchasing-service";
import { SupplierProfilePanel } from "./supplier-profile-panel";
import { PurchaseOrderFormModal } from "./purchase-order-form-modal";

function money(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function PurchasingPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [productsVersion, setProductsVersion] = useState(0);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [activePoId, setActivePoId] = useState<Id | null>(null);
  const [tab, setTab] = useState<"active" | "history">("active");
  const [poModalOpen, setPoModalOpen] = useState(false);
  const [poModalMode, setPoModalMode] = useState<"create" | "edit" | "view">("edit");

  const [poSupplierId, setPoSupplierId] = useState<Id>("");
  const [poReference, setPoReference] = useState("");
  const [poPaymentTerms, setPoPaymentTerms] = useState<PurchasePaymentTerms>("cash");

  const [addItemProductId, setAddItemProductId] = useState<Id>("");
  const [orderMessage, setOrderMessage] = useState<string | null>(null);

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
      <DashboardTopBar
        title="Purchasing"
        subtitle="Purchase orders are instructional memos. On-hand stock increases only when you receive goods."
      />
      <div className="flex-1 space-y-8 px-4 py-8 sm:px-6">
        <PurchaseOrderFormModal
          open={poModalOpen}
          mode={poModalMode}
          suppliers={suppliers}
          purchaseOrder={activePo ?? null}
          onClose={() => setPoModalOpen(false)}
          onChanged={(nextId) => {
            refresh();
            if (nextId !== undefined) setActivePoId(nextId ?? null);
          }}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/dashboard/inventory" className="text-sm font-semibold text-teal-600 hover:underline">
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
            <SupplierProfilePanel suppliers={suppliers} onRefresh={refresh} />

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
                <fieldset className="space-y-2 rounded-lg border border-white/10 p-3">
                  <legend className="px-1 text-xs font-semibold text-neutral-400">Settlement</legend>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-200">
                    <input
                      type="radio"
                      name="new-po-terms"
                      checked={poPaymentTerms === "cash"}
                      onChange={() => setPoPaymentTerms("cash")}
                      className="accent-teal-600"
                    />
                    Cash — pay from COGS Reserves when ordered
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-200">
                    <input
                      type="radio"
                      name="new-po-terms"
                      checked={poPaymentTerms === "credit"}
                      onChange={() => setPoPaymentTerms("credit")}
                      className="accent-teal-600"
                    />
                    Credit — post to supplier creditor (Financial → Creditors)
                  </label>
                </fieldset>
                <button
                  type="button"
                  disabled={!poSupplierId}
                  onClick={() => {
                    const po = PurchasingService.createPurchaseOrder({
                      supplierId: poSupplierId,
                      reference: poReference.trim() || undefined,
                      paymentTerms: poPaymentTerms,
                    });
                    setPoReference("");
                    refresh();
                    setActivePoId(po.id);
                    setPoModalMode("edit");
                    setPoModalOpen(true);
                  }}
                  className="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  Create PO
                </button>
              </div>
            </div>

            <div className="vendor-panel rounded-2xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-white">Purchase orders</h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTab("active")}
                    className={
                      tab === "active"
                        ? "rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white"
                        : "rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-neutral-300 hover:text-white"
                    }
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("history")}
                    className={
                      tab === "history"
                        ? "rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white"
                        : "rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-neutral-300 hover:text-white"
                    }
                  >
                    PO History
                  </button>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {pos.length === 0 ? (
                  <p className="text-sm text-neutral-300">No purchase orders yet.</p>
                ) : (
                  pos
                    .filter((po) => (tab === "active" ? po.id === activePoId || po.status === "draft" : true))
                    .map((po) => {
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
                            ? "border-teal-500/50 bg-white/10"
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
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-neutral-400">
                      Use the form view for A4 print/download and full editing.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setPoModalMode(activePo.status === "draft" ? "edit" : "view");
                        setPoModalOpen(true);
                      }}
                      className="rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-white hover:border-teal-500 hover:text-teal-300"
                    >
                      Open PO form
                    </button>
                  </div>
                  {activePo.status === "draft" ? (
                    <fieldset className="mt-4 space-y-2 rounded-lg border border-white/10 p-3">
                      <legend className="px-1 text-xs font-semibold text-neutral-400">Purchase on</legend>
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-200">
                        <input
                          type="radio"
                          name="active-po-terms"
                          checked={activePo.paymentTerms !== "credit"}
                          onChange={() => {
                            PurchasingService.updatePaymentTerms(activePo.id, "cash");
                            refresh();
                          }}
                          className="accent-teal-600"
                        />
                        Cash (COGS Reserves)
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-200">
                        <input
                          type="radio"
                          name="active-po-terms"
                          checked={activePo.paymentTerms === "credit"}
                          onChange={() => {
                            PurchasingService.updatePaymentTerms(activePo.id, "credit");
                            refresh();
                          }}
                          className="accent-teal-600"
                        />
                        Credit (supplier AP)
                      </label>
                    </fieldset>
                  ) : null}

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
                        className="w-full rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
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
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      aria-label="Decrease quantity"
                                      className="rounded border border-white/20 px-2 py-1 text-xs text-white hover:border-teal-500"
                                      onClick={() => {
                                        PurchasingService.updateItem(activePo.id, it.id, {
                                          orderedQty: Math.max(0, it.orderedQty - 1),
                                        });
                                        refresh();
                                      }}
                                    >
                                      −
                                    </button>
                                    <input
                                      type="number"
                                      min={0}
                                      step={1}
                                      value={it.orderedQty}
                                      aria-label={`Ordered quantity for ${p?.name ?? "product"}`}
                                      title="Ordered quantity"
                                      placeholder="0"
                                      onChange={(e) => {
                                        PurchasingService.updateItem(activePo.id, it.id, {
                                          orderedQty: Number(e.target.value),
                                        });
                                        refresh();
                                      }}
                                      className="vendor-field w-20 rounded-lg px-2 py-1.5 text-center text-sm"
                                    />
                                    <button
                                      type="button"
                                      aria-label="Increase quantity"
                                      className="rounded border border-white/20 px-2 py-1 text-xs text-white hover:border-teal-500"
                                      onClick={() => {
                                        PurchasingService.updateItem(activePo.id, it.id, {
                                          orderedQty: it.orderedQty + 1,
                                        });
                                        refresh();
                                      }}
                                    >
                                      +
                                    </button>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="space-y-1">
                                    <input
                                      type="number"
                                      min={0}
                                      step="any"
                                      value={it.expectedUnitCost}
                                      aria-label={`Expected unit cost for ${p?.name ?? "product"}`}
                                      title="Expected unit cost — defaults from product cost; editable"
                                      placeholder="0.00"
                                      onChange={(e) => {
                                        PurchasingService.updateItem(activePo.id, it.id, {
                                          expectedUnitCost: Number(e.target.value),
                                        });
                                        refresh();
                                      }}
                                      className="vendor-field w-32 rounded-lg px-2 py-1.5 text-sm"
                                    />
                                    {p ? (
                                      <p className="text-[10px] text-neutral-500">
                                        Catalog: {money(defaultExpectedUnitCostFromProduct(p))} (editable)
                                      </p>
                                    ) : null}
                                  </div>
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
                      {activePo.status === "draft" ? (
                        <>
                          {" "}
                          ·{" "}
                          <span className="text-neutral-200">
                            {activePo.paymentTerms === "credit" ? "Credit" : "Cash (COGS)"}
                          </span>
                        </>
                      ) : null}
                    </p>
                    {activePo.status === "draft" ? (
                      <button
                        type="button"
                        onClick={() => {
                          const result = PurchasingService.markOrdered(activePo.id);
                          if (!result.ok) {
                            setOrderMessage(result.error);
                            return;
                          }
                          setOrderMessage(null);
                          refresh();
                        }}
                        className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:border-teal-500 hover:text-teal-600"
                      >
                        Mark ordered
                      </button>
                    ) : null}
                  </div>
                  {orderMessage ? <p className="mt-2 text-xs text-amber-300">{orderMessage}</p> : null}
                </>
              )}
            </div>

            <div className="vendor-panel-soft rounded-2xl p-6">
              <h2 className="text-base font-semibold text-white">Notes</h2>
              <p className="mt-2 text-sm text-neutral-300">
                A PO records intent and settlement when you mark ordered (
                <strong className="text-neutral-200">Cash</strong> from COGS Reserves;{" "}
                <strong className="text-neutral-200">Credit</strong> to supplier creditors). It does not change on-hand
                quantities — receiving posts inventory when stock physically arrives.
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
