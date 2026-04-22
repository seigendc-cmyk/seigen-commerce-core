"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardTopBar } from "@/components/dashboard/dashboard-top-bar";
import { computeCartSaleTax } from "@/modules/financial/lib/pos-sale-tax";
import { cogsReservesLedgerStorageKey } from "@/modules/financial/services/cogs-reserves-ledger";
import { FINANCIAL_LEDGERS_UPDATED_EVENT } from "@/modules/financial/services/financial-events";
import { readTaxOnSalesSettings } from "@/modules/financial/services/tax-settings";
import { landUnitCostFromReadModel } from "@/modules/financial/lib/cogs-cost";
import { InventoryRepo, inventoryKeys } from "@/modules/inventory/services/inventory-repo";
import { getProductReadModel, listProductReadModels } from "@/modules/inventory/services/product-read-model";
import type { ProductReadModel } from "@/modules/inventory/types/product-read-model";
import type { IdeliverExternalProvider } from "@/modules/dashboard/settings/ideliver/ideliver-types";
import { DEFAULT_REGISTER_LABEL } from "../mock";
import {
  addOrIncrementFromProduct,
  emptyCart,
  incrementLine,
  overrideLineUnitPrice,
  removeLine,
  setCartDelivery,
  setLineQty,
} from "../services/cart-service";
import { cartAmountDue, computeCartDeliveryFee } from "../services/delivery-pricing";
import { ideliverProvidersStorageKey, loadIdeliverProviders } from "../services/ideliver-repo";
import { emitPosSaleCompletedBrainEventDurable } from "@/modules/brain/brain-outbox";
import { finalizeSale } from "../services/sales-service";
import type { Cart, PaymentMethod, Sale } from "../types/pos";
import { PosReceiptBrandingPanel } from "./pos-receipt-branding-panel";
import { PosSalesHistoryTab } from "./pos-sales-history-tab";
import { authzCheck } from "@/modules/authz/authz-actions";
import { useWorkspace } from "@/components/dashboard/workspace-context";
import {
  buildBranchReconciliationPackageV1,
  downloadBranchReconciliationPackageJson,
  readReconLastExportedAt,
  writeReconLastExportedAt,
} from "@/modules/reconciliation/branch-reconciliation-package";
import { ReconImportModal } from "@/modules/reconciliation/ui/recon-import-modal";

function money(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function isContentionStatus(s: string | null): boolean {
  const t = (s ?? "").toLowerCase();
  return t.includes("stock changed while checking out") || t.includes("another terminal may have sold");
}

/** When non-null, POS must not add this product to the cart. */
function posProductBlockedReason(p: ProductReadModel): string | null {
  if (!p.active) return "Inactive in catalog.";
  if (p.forSale === false) return "Not for sale at POS (admin).";
  if (p.onHandQty < 1) return "No stock on hand.";
  return null;
}

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  mobile_money: "Mobile money",
  bank: "Bank",
  other: "Other",
};

const IDELIVER_EVENT = "seigen-ideliver-updated";

export function PosPage() {
  const ws = useWorkspace();
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Cart>(() => emptyCart());
  const [tenderLines, setTenderLines] = useState<Array<{ id: string; method: PaymentMethod; amount: string }>>([
    { id: "t1", method: "cash", amount: "" },
  ]);
  const [status, setStatus] = useState<string | null>(null);
  const [salesTick, setSalesTick] = useState(0);
  const [pinnedReceipt, setPinnedReceipt] = useState<Sale | null>(null);
  const [ideliverProviders, setIdeliverProviders] = useState<IdeliverExternalProvider[]>([]);
  const [finTick, setFinTick] = useState(0);
  const [branchTick, setBranchTick] = useState(0);
  const [priceEditFor, setPriceEditFor] = useState<string | null>(null);
  const [priceEditValue, setPriceEditValue] = useState("");
  const [posTab, setPosTab] = useState<"checkout" | "history">("checkout");
  const [showReconImport, setShowReconImport] = useState(false);

  const refreshCatalog = useCallback(() => setCatalogVersion((v) => v + 1), []);

  const refreshIdeliver = useCallback(() => {
    setIdeliverProviders(loadIdeliverProviders());
  }, []);

  useEffect(() => {
    refreshIdeliver();
  }, [refreshIdeliver]);

  useEffect(() => {
    const onFin = () => setFinTick((t) => t + 1);
    window.addEventListener(FINANCIAL_LEDGERS_UPDATED_EVENT, onFin);
    return () => window.removeEventListener(FINANCIAL_LEDGERS_UPDATED_EVENT, onFin);
  }, []);

  useEffect(() => {
    const onBranches = () => setBranchTick((t) => t + 1);
    window.addEventListener("seigen-inventory-branches-updated", onBranches);
    return () => window.removeEventListener("seigen-inventory-branches-updated", onBranches);
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === inventoryKeys.db()) {
        refreshCatalog();
        setBranchTick((t) => t + 1);
      }
      if (e.key === ideliverProvidersStorageKey) refreshIdeliver();
    };
    const onVis = () => {
      if (document.visibilityState === "visible") refreshCatalog();
    };
    const onIdeliver = () => refreshIdeliver();
    window.addEventListener("storage", onStorage);
    window.addEventListener(IDELIVER_EVENT, onIdeliver);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(IDELIVER_EVENT, onIdeliver);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refreshCatalog, refreshIdeliver]);

  const tradingBranch = useMemo(() => {
    void branchTick;
    void catalogVersion;
    return InventoryRepo.getDefaultTradingBranch();
  }, [branchTick, catalogVersion]);

  const hasTradingShop = Boolean(tradingBranch);
  const lastReconExportedAt = tradingBranch ? readReconLastExportedAt(tradingBranch.id) : null;

  const catalog = useMemo(() => {
    void catalogVersion;
    void branchTick;
    if (!tradingBranch) return [];
    return listProductReadModels(tradingBranch.id);
  }, [catalogVersion, branchTick, tradingBranch]);

  const onHandByProductId = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of catalog) m.set(p.id, p.onHandQty);
    return m;
  }, [catalog]);

  const amountDue = useMemo(() => cartAmountDue(cart, ideliverProviders), [cart, ideliverProviders, finTick]);
  const deliveryFeePreview = useMemo(
    () => computeCartDeliveryFee(cart, ideliverProviders),
    [cart, ideliverProviders],
  );
  const cartTax = useMemo(() => {
    void finTick;
    return computeCartSaleTax(cart, ideliverProviders);
  }, [cart, ideliverProviders, finTick]);
  const taxSettingsPreview = useMemo(() => readTaxOnSalesSettings(), [finTick]);

  /** Estimated COGS for current cart (same basis as COGS Reserves posting on tender). */
  const estimatedCartCogs = useMemo(() => {
    void catalogVersion;
    let total = 0;
    for (const it of cart.items) {
      const rm = getProductReadModel(it.productId);
      const unit = rm ? landUnitCostFromReadModel(rm) : 0;
      total += Math.round(unit * it.qty * 100) / 100;
    }
    return Math.round(total * 100) / 100;
  }, [cart.items, catalogVersion]);

  const hasInsufficientStock = useMemo(
    () =>
      cart.items.some((it) => it.qty > (onHandByProductId.get(it.productId) ?? 0)),
    [cart.items, onHandByProductId],
  );

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    const active = catalog.filter((p) => p.active);
    if (!q) return active.slice(0, 24);
    return active
      .filter(
        (p) =>
          p.sku.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          (p.barcode?.toLowerCase().includes(q) ?? false),
      )
      .slice(0, 24);
  }, [catalog, search]);

  function addProduct(p: ProductReadModel) {
    const blocked = posProductBlockedReason(p);
    if (blocked) {
      setStatus(blocked);
      setTimeout(() => setStatus(null), 4000);
      return;
    }
    setCart((c) => addOrIncrementFromProduct(c, p, 1));
    setStatus(null);
  }

  async function applyPriceOverride(productId: string) {
    const next = Number(priceEditValue);
    if (!Number.isFinite(next) || next <= 0) {
      setStatus("Enter a valid unit price.");
      setTimeout(() => setStatus(null), 3500);
      return;
    }

    const auth = await authzCheck("pos.price.override", {
      scopeEntityType: "terminal",
      // terminal scope can be introduced later; for now, this validates permission + critical reason rules.
      criticalReason: `POS price override for ${productId} to ${next}`,
    });
    if (!auth.allowed) {
      setStatus(auth.reasonMessage);
      setTimeout(() => setStatus(null), 4500);
      return;
    }

    setCart((c) => overrideLineUnitPrice(c, productId, next));
    setPriceEditFor(null);
    setPriceEditValue("");
    setStatus("Price override applied.");
    setTimeout(() => setStatus(null), 2500);
  }

  function completeSale() {
    const payments = tenderLines
      .map((l) => ({ method: l.method, amount: Number(l.amount) }))
      .filter((p) => Number.isFinite(p.amount) && p.amount > 0);
    const result = finalizeSale(cart, payments);
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    const { sale } = result;
    const correlationId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `corr_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    void emitPosSaleCompletedBrainEventDurable({ sale, correlationId });
    setCart(emptyCart());
    setTenderLines([{ id: "t1", method: "cash", amount: "" }]);
    refreshCatalog();
    setSalesTick((t) => t + 1);
    setPinnedReceipt(sale);
    setStatus(
      `Receipt ${sale.receiptNumber} · ${sale.status}. Change: ${money(sale.changeDue)}` +
        (sale.deliveryFee > 0 ? ` · iDeliver credit ${money(sale.deliveryFee)}` : ""),
    );
    setTimeout(() => setStatus(null), 4500);
  }

  const namedProviders = ideliverProviders.filter((p) => p.fullName.trim().length > 0);

  return (
    <>
      <DashboardTopBar
        title="Point of sale"
        subtitle={`${DEFAULT_REGISTER_LABEL} · dynamic cart · iDeliver fares · 80-col PDF receipt`}
      />
      <div
        data-pos-light
        className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-4 sm:px-6"
      >
        {hasTradingShop && ws?.tenant?.id ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Multi-terminal safety</p>
                <p className="mt-1 text-xs text-slate-600">
                  Drift visibility via reconciliation packages. Last export:{" "}
                  <span className="font-semibold">
                    {lastReconExportedAt ? new Date(lastReconExportedAt).toLocaleString() : "—"}
                  </span>
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900 hover:bg-slate-100"
                onClick={() => {
                  if (!tradingBranch) return;
                  const tenantId = ws.tenant.id;
                  const pkg = buildBranchReconciliationPackageV1({ tenantId, branchId: tradingBranch.id });
                  const ts = new Date().toISOString().replaceAll(":", "").slice(0, 15);
                  downloadBranchReconciliationPackageJson(`recon_${tenantId}_${tradingBranch.id}_${ts}.json`, pkg);
                  writeReconLastExportedAt(tradingBranch.id, new Date().toISOString());
                  setStatus("Reconciliation package exported.");
                  setTimeout(() => setStatus(null), 2500);
                }}
              >
                Export reconciliation package
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 hover:bg-slate-50"
                onClick={() => setShowReconImport(true)}
              >
                Import package (MVP)
              </button>
            </div>
          </div>
        ) : null}

        {!hasTradingShop ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm">
            <strong className="font-semibold text-amber-950">No trading shop yet.</strong> Head office cannot ring sales
            or hold POS stock. Add a trading branch under{" "}
            <Link href="/dashboard/inventory" className="font-semibold text-teal-700 underline">
              Inventory → Overview
            </Link>
            .
          </div>
        ) : null}

        <div className="flex shrink-0 gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setPosTab("checkout")}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
              posTab === "checkout" ? "bg-teal-600 text-white shadow-sm" : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            Checkout
          </button>
          <button
            type="button"
            onClick={() => setPosTab("history")}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
              posTab === "history" ? "bg-teal-600 text-white shadow-sm" : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            Sales History
          </button>
        </div>

        {posTab === "checkout" ? (
          <div className="grid min-h-0 grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6 lg:items-stretch">
        <section className="vendor-panel flex min-h-[min(72vh,640px)] flex-col rounded-2xl">
          <div className="border-b border-slate-200/90 p-4">
            <label className="sr-only" htmlFor="pos-search">
              Search products
            </label>
            <input
              id="pos-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="SKU, name, barcode…"
              className="vendor-field w-full rounded-lg px-3 py-2.5 text-sm"
              autoComplete="off"
            />
            <p className="pos-data-log-muted mt-2 text-xs">
              Tap a row to add · only active, in-stock, POS-enabled SKUs · selling price from inventory.
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {matches.length === 0 ? (
              <p className="pos-data-log p-3 text-sm">No matches.</p>
            ) : (
              <ul className="space-y-1">
                {matches.map((p) => {
                  const blocked = posProductBlockedReason(p);
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        disabled={Boolean(blocked)}
                        title={blocked ?? "Add to cart"}
                        onClick={() => addProduct(p)}
                        className={
                          blocked
                            ? "flex w-full cursor-not-allowed items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-sm opacity-70"
                            : "flex w-full items-start justify-between gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left text-sm transition-colors hover:border-teal-400/50 hover:bg-slate-50"
                        }
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 h-10 w-10 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                            {p.primaryImage?.dataUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.primaryImage.dataUrl} alt="" className="h-full w-full object-cover" />
                            ) : null}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{p.name}</p>
                            <p className="pos-data-log text-xs">
                              {p.sku} · {p.unit} · stock {p.onHandQty}
                            </p>
                            {blocked ? (
                              <p className="mt-1 text-[11px] font-semibold text-amber-700">{blocked}</p>
                            ) : null}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-semibold text-teal-700">{money(p.sellingPrice)}</p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section className="vendor-panel flex min-h-[min(72vh,640px)] flex-col rounded-2xl">
          <div className="flex items-center justify-between border-b border-slate-200/90 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Cart</h2>
            <Link href="/dashboard/inventory" className="text-xs font-semibold text-teal-700 hover:underline">
              Inventory
            </Link>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {cart.items.length === 0 ? (
              <p className="pos-data-log text-sm">Empty — search and add lines.</p>
            ) : (
              <ul className="space-y-2">
                {cart.items.map((it) => (
                  <li
                    key={it.productId}
                    className="rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-2 text-sm shadow-sm"
                  >
                    <div className="flex justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900">{it.name}</p>
                        <p className="pos-data-log text-xs">
                          {it.sku} @ {money(it.unitPrice)}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {priceEditFor === it.productId ? (
                            <>
                              <input
                                value={priceEditValue}
                                onChange={(e) => setPriceEditValue(e.target.value)}
                                inputMode="decimal"
                                placeholder={String(it.unitPrice)}
                                className="vendor-field w-28 rounded px-2 py-1 text-xs"
                                aria-label={`Override unit price for ${it.name}`}
                              />
                              <button
                                type="button"
                                className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-800 hover:border-teal-500"
                                onClick={() => void applyPriceOverride(it.productId)}
                              >
                                Apply
                              </button>
                              <button
                                type="button"
                                className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-300"
                                onClick={() => {
                                  setPriceEditFor(null);
                                  setPriceEditValue("");
                                }}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-800 hover:border-teal-500"
                              onClick={() => {
                                setPriceEditFor(it.productId);
                                setPriceEditValue(String(it.unitPrice));
                              }}
                            >
                              Override price
                            </button>
                          )}
                        </div>
                        {it.qty > (onHandByProductId.get(it.productId) ?? 0) ? (
                          <p className="mt-1 text-xs font-semibold text-amber-800">
                            Only {onHandByProductId.get(it.productId) ?? 0} on hand at default branch.
                          </p>
                        ) : null}
                      </div>
                      <p className="shrink-0 font-semibold text-slate-800">{money(it.lineTotal)}</p>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800 hover:border-teal-500"
                        onClick={() =>
                          setCart((c) =>
                            incrementLine(c, it.productId, -1, onHandByProductId.get(it.productId)),
                          )
                        }
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        title="Quantity"
                        aria-label={`Quantity for ${it.name}`}
                        value={it.qty}
                        max={onHandByProductId.get(it.productId) ?? 0}
                        onChange={(e) =>
                          setCart((c) =>
                            setLineQty(
                              c,
                              it.productId,
                              Number(e.target.value),
                              onHandByProductId.get(it.productId),
                            ),
                          )
                        }
                        className="vendor-field w-14 rounded px-2 py-1 text-center text-xs"
                      />
                      <button
                        type="button"
                        aria-label="Increase quantity"
                        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800 hover:border-teal-500"
                        disabled={it.qty >= (onHandByProductId.get(it.productId) ?? 0)}
                        onClick={() =>
                          setCart((c) =>
                            incrementLine(c, it.productId, 1, onHandByProductId.get(it.productId)),
                          )
                        }
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className="ml-auto text-xs font-semibold text-slate-600 hover:text-slate-900"
                        onClick={() => setCart((c) => removeLine(c, it.productId))}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-slate-200/90 p-4 space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-3 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-900">iDeliver</h3>
                <Link
                  href="/dashboard/settings?tab=ideliver"
                  className="text-[10px] font-semibold text-teal-700 hover:underline"
                >
                  Configure staff &amp; fares
                </Link>
              </div>
              <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-800">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-teal-600"
                  checked={cart.delivery.enabled}
                  onChange={(e) =>
                    setCart((c) => setCartDelivery(c, { enabled: e.target.checked }))
                  }
                />
                Add delivery to this sale
              </label>
              {cart.delivery.enabled ? (
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="pos-data-log-muted block text-[10px] font-semibold" htmlFor="ideliver-staff">
                      iDeliver staff / provider
                    </label>
                    <select
                      id="ideliver-staff"
                      value={cart.delivery.providerId ?? ""}
                      onChange={(e) =>
                        setCart((c) =>
                          setCartDelivery(c, {
                            providerId: e.target.value || null,
                          }),
                        )
                      }
                      className="vendor-field mt-1 w-full rounded-lg px-2 py-2 text-sm"
                    >
                      <option value="">Select provider…</option>
                      {namedProviders.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.fullName.trim()}
                        </option>
                      ))}
                    </select>
                    {namedProviders.length === 0 ? (
                      <p className="mt-1 text-[10px] font-medium text-amber-800">
                        Add named providers under Settings → iDeliver to enable selection.
                      </p>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="pos-data-log-muted block text-[10px] font-semibold" htmlFor="ideliver-km">
                        Distance (km)
                      </label>
                      <input
                        id="ideliver-km"
                        type="number"
                        min={0}
                        step="any"
                        value={cart.delivery.distanceKm}
                        onChange={(e) =>
                          setCart((c) =>
                            setCartDelivery(c, { distanceKm: Number(e.target.value) }),
                          )
                        }
                        className="vendor-field mt-1 w-full rounded-lg px-2 py-2 text-sm"
                      />
                    </div>
                    <div className="flex flex-col justify-end">
                      <p className="pos-data-log-muted text-[10px]">Computed fare</p>
                      <p className="font-mono text-sm font-semibold text-slate-900">{money(deliveryFeePreview)}</p>
                    </div>
                  </div>
                  <label className="flex cursor-pointer items-start gap-2 text-xs font-medium text-slate-800">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-teal-600"
                      checked={cart.delivery.overrideEnabled}
                      onChange={(e) =>
                        setCart((c) => setCartDelivery(c, { overrideEnabled: e.target.checked }))
                      }
                    />
                    <span>
                      Override fare (manager)
                      <span className="pos-data-log-muted mt-1 block text-[10px]">
                        Replaces radius schedule for this cart only.
                      </span>
                    </span>
                  </label>
                  {cart.delivery.overrideEnabled ? (
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={cart.delivery.overrideAmount}
                      onChange={(e) =>
                        setCart((c) =>
                          setCartDelivery(c, { overrideAmount: Number(e.target.value) }),
                        )
                      }
                      className="vendor-field w-full rounded-lg px-2 py-2 text-sm"
                      aria-label="Override delivery amount"
                    />
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-900">COGS Reserves</h3>
                <Link
                  href="/dashboard/financial?tab=seed"
                  className="text-[10px] font-semibold text-teal-700 hover:underline"
                >
                  Seed Account
                </Link>
              </div>
              <p className="mt-2 flex items-baseline justify-between gap-2 text-sm">
                <span className="pos-data-log">Estimated COGS (cart)</span>
                <span className="font-mono font-semibold text-[#36454f]">{money(estimatedCartCogs)}</span>
              </p>
              <p className="pos-data-log-muted mt-2 text-[10px] leading-relaxed">
                Landed unit cost × qty posts to the COGS Reserves ledger when you complete the sale (isolated from
                revenue).
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-baseline justify-between text-sm">
                <span className="pos-data-log">Goods</span>
                <span className="font-semibold text-slate-900">{money(cart.subtotal)}</span>
              </div>
              {cart.delivery.enabled ? (
                <div className="flex items-baseline justify-between text-sm">
                  <span className="pos-data-log">Delivery (iDeliver)</span>
                  <span className="font-semibold text-slate-900">{money(deliveryFeePreview)}</span>
                </div>
              ) : null}
              {cartTax.salesTax > 0 ? (
                <div className="flex items-baseline justify-between text-sm">
                  <span className="pos-data-log">
                    {taxSettingsPreview.taxLabel}
                    {taxSettingsPreview.pricesTaxInclusive ? " (in prices)" : " (added)"}
                  </span>
                  <span className="font-semibold text-slate-900">{money(cartTax.salesTax)}</span>
                </div>
              ) : null}
              <div className="flex items-baseline justify-between border-t border-slate-200 pt-2">
                <span className="text-sm font-semibold text-slate-800">Amount due</span>
                <span className="text-lg font-semibold text-teal-700">{money(amountDue)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="pos-data-log block text-xs font-semibold">Payments (split tender)</p>
              {tenderLines.map((l, idx) => (
                <div key={l.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <select
                    className="vendor-field w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                    value={l.method}
                    onChange={(e) =>
                      setTenderLines((prev) =>
                        prev.map((x) => (x.id === l.id ? { ...x, method: e.target.value as PaymentMethod } : x)),
                      )
                    }
                    aria-label={`Payment method ${idx + 1}`}
                  >
                    {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((m) => (
                      <option key={m} value={m}>
                        {PAYMENT_LABELS[m]}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    placeholder="Amount"
                    value={l.amount}
                    onChange={(e) =>
                      setTenderLines((prev) =>
                        prev.map((x) => (x.id === l.id ? { ...x, amount: e.target.value } : x)),
                      )
                    }
                    className="vendor-field w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                    aria-label={`Payment amount ${idx + 1}`}
                  />
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 disabled:opacity-40"
                    disabled={tenderLines.length <= 1}
                    onClick={() => setTenderLines((prev) => prev.filter((x) => x.id !== l.id))}
                    aria-label={`Remove payment line ${idx + 1}`}
                  >
                    −
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 hover:bg-slate-50"
                onClick={() =>
                  setTenderLines((prev) => [...prev, { id: `t${Date.now()}`, method: "mobile_money", amount: "" }])
                }
              >
                Add split payment
              </button>
            </div>

            {status ? (
              <div className="space-y-2">
                <p className="pos-data-log text-xs">{status}</p>
                {isContentionStatus(status) && hasTradingShop && ws?.tenant?.id ? (
                  <button
                    type="button"
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 py-2 text-xs font-bold text-slate-900 hover:bg-slate-100"
                    onClick={() => {
                      if (!tradingBranch) return;
                      const tenantId = ws.tenant.id;
                      const pkg = buildBranchReconciliationPackageV1({ tenantId, branchId: tradingBranch.id });
                      const ts = new Date().toISOString().replaceAll(":", "").slice(0, 15);
                      downloadBranchReconciliationPackageJson(`recon_${tenantId}_${tradingBranch.id}_${ts}.json`, pkg);
                      writeReconLastExportedAt(tradingBranch.id, new Date().toISOString());
                      setStatus("Reconciliation package exported (use R2 diff to compare two terminals).");
                      setTimeout(() => setStatus(null), 3500);
                    }}
                  >
                    Export reconciliation package (conflict helper)
                  </button>
                ) : null}
              </div>
            ) : null}

            <button
              type="button"
              disabled={cart.items.length === 0 || hasInsufficientStock || !hasTradingShop}
              onClick={completeSale}
              className="w-full rounded-lg bg-teal-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-40"
            >
              Complete sale
            </button>
            {hasInsufficientStock ? (
              <p className="text-xs font-medium text-amber-800">
                Reduce quantities to match on-hand stock before completing.
              </p>
            ) : null}
            <p className="pos-data-log text-[11px] leading-relaxed">
              Sale saves to <span className="font-mono text-[#36454f]">seigen.pos:v1:sales</span>. COGS posts to{" "}
              <span className="font-mono text-[#36454f]">{cogsReservesLedgerStorageKey()}</span>. Delivery fees credit the
              selected provider in <span className="font-mono text-[#36454f]">seigen.pos:v1:ideliver_ledger</span> for
              payout / COA mapping.
            </p>

            <PosReceiptBrandingPanel />
          </div>
        </section>
          </div>
        ) : (
          <section className="vendor-panel flex min-h-[min(72vh,640px)] min-w-0 flex-col rounded-2xl p-4">
            <PosSalesHistoryTab
              refreshTrigger={salesTick}
              catalogTick={catalogVersion}
              pinnedSale={pinnedReceipt}
              onDismissPin={() => setPinnedReceipt(null)}
            />
          </section>
        )}
      </div>

      {ws?.tenant?.id && tradingBranch ? (
        <ReconImportModal
          open={showReconImport}
          onClose={() => setShowReconImport(false)}
          tenantId={ws.tenant.id}
          branchId={tradingBranch.id}
          operatorLabel="POS desk"
        />
      ) : null}
    </>
  );
}
