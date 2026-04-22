"use client";

import { useMemo, useState } from "react";
import type { Id, PurchaseOrder, PurchasePaymentTerms, Supplier } from "../types/models";
import { InventoryRepo } from "../services/inventory-repo";
import { listProductReadModels } from "../services/product-read-model";
import { defaultExpectedUnitCostFromProduct, PurchasingService } from "../services/purchasing-service";
import { downloadPurchaseOrderHtml, openPurchaseOrderPrint } from "../services/purchase-order-document";

function money(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function PurchaseOrderFormModal({
  open,
  mode,
  suppliers,
  purchaseOrder,
  onClose,
  onChanged,
}: {
  open: boolean;
  mode: "create" | "edit" | "view";
  suppliers: Supplier[];
  purchaseOrder: PurchaseOrder | null;
  onClose: () => void;
  onChanged: (nextActivePoId?: Id | null) => void;
}) {
  const po = purchaseOrder;
  const canEdit = Boolean(po && po.status === "draft" && mode !== "view");

  const branches = useMemo(() => InventoryRepo.listBranches(), []);
  const products = useMemo(() => listProductReadModels(), []);

  const [supplierId, setSupplierId] = useState<Id>(() => (po?.supplierId ?? "") as Id);
  const [branchId, setBranchId] = useState<Id>(() => (po?.branchId ?? "") as Id);
  const [reference, setReference] = useState(() => po?.reference ?? "");
  const [notes, setNotes] = useState(() => po?.notes ?? "");
  const [paymentTerms, setPaymentTerms] = useState<PurchasePaymentTerms>(() => (po?.paymentTerms ?? "cash") as any);
  const [addItemProductId, setAddItemProductId] = useState<Id>("");
  const [msg, setMsg] = useState<string | null>(null);

  const activeSupplier = useMemo(() => (supplierId ? InventoryRepo.getSupplier(supplierId) : null), [supplierId, suppliers]);
  const activeBranch = useMemo(() => (branchId ? InventoryRepo.getBranch(branchId) : null), [branchId]);

  const totals = useMemo(() => {
    if (!po) return { lines: 0, qty: 0, total: 0 };
    let qty = 0;
    let total = 0;
    for (const it of po.items) {
      qty += it.orderedQty;
      total += it.orderedQty * it.expectedUnitCost;
    }
    return { lines: po.items.length, qty, total };
  }, [po]);

  function syncMeta() {
    if (!po) return;
    PurchasingService.updatePurchaseOrderMeta(po.id, { supplierId, branchId, reference, notes });
    PurchasingService.updatePaymentTerms(po.id, paymentTerms);
    onChanged(po.id);
  }

  function close() {
    setMsg(null);
    onClose();
  }

  if (!open || !po) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/70 p-4">
      <div className="w-full max-w-[980px]">
        <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-3 text-sm text-neutral-200">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-semibold text-white">
              Purchase Order form · {po.status.toUpperCase()} · {po.reference?.trim() ? po.reference : po.id}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="vendor-btn-secondary-dark font-semibold" onClick={close}>
                Close
              </button>
              <button
                type="button"
                className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15"
                onClick={() => openPurchaseOrderPrint(po)}
              >
                Print / Save PDF
              </button>
              <button
                type="button"
                className="rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold text-white hover:border-teal-500 hover:text-teal-300"
                onClick={() => downloadPurchaseOrderHtml(`purchase_order_${po.id}.html`, po)}
              >
                Download (HTML)
              </button>
            </div>
          </div>
          {msg ? <p className="mt-2 text-xs text-amber-200">{msg}</p> : null}
        </div>

        {/* A4-ish sheet */}
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-lg font-semibold text-slate-900">Purchase Order</h1>
                <p className="mt-1 text-xs text-slate-500">
                  {new Date(po.createdAt).toLocaleString()} · Status: {po.status} · Lines {totals.lines} · Qty {totals.qty}
                </p>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold uppercase text-slate-500">Estimated total</div>
                <div className="mt-1 text-xl font-bold text-slate-900">{money(totals.total)}</div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Supplier</div>
              <select
                disabled={!canEdit}
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Select supplier…</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <div className="mt-2 text-xs text-slate-600">
                {activeSupplier?.email?.trim() || activeSupplier?.phone?.trim()
                  ? `${activeSupplier?.phone ?? ""}${activeSupplier?.phone && activeSupplier?.email ? " · " : ""}${activeSupplier?.email ?? ""}`
                  : "—"}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Deliver to (branch / warehouse)</div>
              <select
                disabled={!canEdit}
                value={branchId}
                onChange={(e) => setBranchId(e.target.value as Id)}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Select branch…</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <div className="mt-2 text-xs text-slate-600">{activeBranch?.address?.trim() ? activeBranch.address : "—"}</div>
            </div>
          </div>

          <div className="grid gap-4 px-6 pb-2 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reference</div>
              <input
                disabled={!canEdit}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. Quote 123 / Invoice ref"
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment terms</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => setPaymentTerms("cash")}
                  className={[
                    "rounded-lg border px-3 py-2 text-sm font-semibold",
                    paymentTerms === "cash" ? "border-teal-600 bg-teal-50 text-teal-900" : "border-slate-200 text-slate-700",
                  ].join(" ")}
                >
                  Cash (COGS)
                </button>
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => setPaymentTerms("credit")}
                  className={[
                    "rounded-lg border px-3 py-2 text-sm font-semibold",
                    paymentTerms === "credit" ? "border-teal-600 bg-teal-50 text-teal-900" : "border-slate-200 text-slate-700",
                  ].join(" ")}
                >
                  Credit (AP)
                </button>
              </div>
            </div>
          </div>

          <div className="px-6 py-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Line items</div>
                <div className="mt-1 text-xs text-slate-600">Add products, set qty and expected unit cost.</div>
              </div>
              {canEdit ? (
                <div className="flex gap-2">
                  <select
                    value={addItemProductId}
                    onChange={(e) => setAddItemProductId(e.target.value)}
                    className="w-[min(60vw,420px)] rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">Select product…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} · {p.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!addItemProductId}
                    onClick={() => {
                      PurchasingService.addItem(po.id, addItemProductId);
                      setAddItemProductId("");
                      onChanged(po.id);
                    }}
                    className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              ) : null}
            </div>

            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide">Product</th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide">Qty</th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide">Unit cost</th>
                    <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide">Line</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {po.items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-sm text-slate-500">
                        No items yet.
                      </td>
                    </tr>
                  ) : (
                    po.items.map((it) => {
                      const p = InventoryRepo.getProduct(it.productId);
                      const line = it.orderedQty * it.expectedUnitCost;
                      return (
                        <tr key={it.id}>
                          <td className="px-3 py-3">
                            <div className="font-medium text-slate-900">{p?.name ?? "Product"}</div>
                            <div className="text-xs text-slate-500">{p?.sku ?? it.productId}</div>
                          </td>
                          <td className="px-3 py-3">
                            <input
                              disabled={!canEdit}
                              type="number"
                              min={0}
                              step={1}
                              value={it.orderedQty}
                              onChange={(e) => {
                                PurchasingService.updateItem(po.id, it.id, { orderedQty: Number(e.target.value) });
                                onChanged(po.id);
                              }}
                              className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <input
                              disabled={!canEdit}
                              type="number"
                              min={0}
                              step="any"
                              value={it.expectedUnitCost}
                              onChange={(e) => {
                                PurchasingService.updateItem(po.id, it.id, { expectedUnitCost: Number(e.target.value) });
                                onChanged(po.id);
                              }}
                              className="w-32 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                            />
                            {p ? (
                              <div className="mt-1 text-[11px] text-slate-500">
                                Catalog: {money(defaultExpectedUnitCostFromProduct(p))}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-3 py-3 font-semibold text-slate-800">{money(line)}</td>
                          <td className="px-3 py-3 text-right">
                            {canEdit ? (
                              <button
                                type="button"
                                className="text-sm font-semibold text-rose-700 hover:underline"
                                onClick={() => {
                                  PurchasingService.removeItem(po.id, it.id);
                                  onChanged(po.id);
                                }}
                              >
                                Remove
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4 px-6 pb-6 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</div>
              <textarea
                disabled={!canEdit}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-2 min-h-[96px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Optional notes (delivery window, items to confirm, etc.)"
              />
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</div>
              <div className="mt-2 space-y-2">
                {canEdit ? (
                  <button
                    type="button"
                    className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black"
                    onClick={() => {
                      try {
                        syncMeta();
                        setMsg("Saved draft.");
                        window.setTimeout(() => setMsg(null), 1800);
                      } catch (e) {
                        setMsg(e instanceof Error ? e.message : "Could not save.");
                      }
                    }}
                  >
                    Save draft
                  </button>
                ) : null}
                {po.status === "draft" ? (
                  <button
                    type="button"
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                    onClick={() => {
                      try {
                        syncMeta();
                        const res = PurchasingService.markOrdered(po.id);
                        if (!res.ok) {
                          setMsg(res.error);
                          return;
                        }
                        setMsg("Marked ordered.");
                        onChanged(po.id);
                      } catch (e) {
                        setMsg(e instanceof Error ? e.message : "Could not mark ordered.");
                      }
                    }}
                  >
                    Mark ordered
                  </button>
                ) : (
                  <button
                    type="button"
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                    onClick={() => {
                      try {
                        const next = PurchasingService.cloneToDraft(po.id);
                        onChanged(next.id);
                      } catch (e) {
                        setMsg(e instanceof Error ? e.message : "Could not clone.");
                      }
                    }}
                  >
                    Clone to new draft
                  </button>
                )}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Print uses your browser’s “Save as PDF”. Drafts can be edited; ordered POs should be cloned.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

