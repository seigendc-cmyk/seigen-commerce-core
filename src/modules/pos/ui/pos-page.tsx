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
import { emitPosSaleCompletedBrainEvent } from "@/modules/brain/brain-actions";
import { finalizeSale } from "../services/sales-service";
import type { Cart, PaymentMethod, Sale } from "../types/pos";
import { PosReceiptBrandingPanel } from "./pos-receipt-branding-panel";
import { PosSalesHistory } from "./pos-sales-history";
import { authzCheck } from "@/modules/authz/authz-actions";

function money(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
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
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Cart>(() => emptyCart());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [tenderInput, setTenderInput] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [salesTick, setSalesTick] = useState(0);
  const [pinnedReceipt, setPinnedReceipt] = useState<Sale | null>(null);
  const [ideliverProviders, setIdeliverProviders] = useState<IdeliverExternalProvider[]>([]);
  const [finTick, setFinTick] = useState(0);
  const [branchTick, setBranchTick] = useState(0);
  const [priceEditFor, setPriceEditFor] = useState<string | null>(null);
  const [priceEditValue, setPriceEditValue] = useState("");

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
      if (e.key === inventoryKeys.db) {
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

  const catalog = useMemo(() => {
    void catalogVersion;
    void branchTick;
    return listProductReadModels();
  }, [catalogVersion, branchTick]);

  const hasTradingShop = useMemo(() => {
    void branchTick;
    void catalogVersion;
    return Boolean(InventoryRepo.getDefaultTradingBranch());
  }, [branchTick, catalogVersion]);

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
    const amount = Number(tenderInput);
    const payment = { method: paymentMethod, amount: Number.isFinite(amount) ? amount : 0 };
    const result = finalizeSale(cart, payment);
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    const { sale } = result;
    const correlationId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `corr_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    void emitPosSaleCompletedBrainEvent({ sale, correlationId });
    setCart(emptyCart());
    setTenderInput("");
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
      <div className="mx-auto grid min-h-0 w-full max-w-7xl flex-1 grid-cols-1 gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(360px,1.1fr)_minmax(380px,0.9fr)_minmax(340px,0.8fr)] lg:gap-6">
        {!hasTradingShop ? (
          <div className="col-span-full rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            <strong className="text-amber-50">No trading shop yet.</strong> Head office cannot ring sales or hold POS
            stock. Add a trading branch under{" "}
            <Link href="/dashboard/inventory" className="font-semibold text-teal-600 underline">
              Inventory → Overview
            </Link>
            .
          </div>
        ) : null}
        <section className="vendor-panel flex min-h-[320px] flex-col rounded-2xl lg:max-w-none">
          <div className="border-b border-white/10 p-4">
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
            <p className="mt-2 text-xs text-neutral-400">
              Tap a row to add · only active, in-stock, POS-enabled SKUs · selling price from inventory.
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {matches.length === 0 ? (
              <p className="p-3 text-sm text-neutral-300">No matches.</p>
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
                            ? "flex w-full cursor-not-allowed items-start justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5 text-left text-sm opacity-60"
                            : "flex w-full items-start justify-between gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left text-sm transition-colors hover:border-teal-500/40 hover:bg-white/5"
                        }
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 h-10 w-10 overflow-hidden rounded-lg border border-white/10 bg-black/30">
                            {p.primaryImage?.dataUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.primaryImage.dataUrl} alt="" className="h-full w-full object-cover" />
                            ) : null}
                          </div>
                          <div>
                            <p className="font-medium text-white">{p.name}</p>
                            <p className="text-xs text-neutral-400">
                              {p.sku} · {p.unit} · stock {p.onHandQty}
                            </p>
                            {blocked ? (
                              <p className="mt-1 text-[11px] font-medium text-amber-400/95">{blocked}</p>
                            ) : null}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-semibold text-teal-600">{money(p.sellingPrice)}</p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section className="vendor-panel flex flex-col rounded-2xl lg:min-w-[360px]">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <h2 className="text-sm font-semibold text-white">Cart</h2>
            <Link href="/dashboard/inventory" className="text-xs font-semibold text-teal-600 hover:underline">
              Inventory
            </Link>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {cart.items.length === 0 ? (
              <p className="text-sm text-neutral-300">Empty — search and add lines.</p>
            ) : (
              <ul className="space-y-2">
                {cart.items.map((it) => (
                  <li
                    key={it.productId}
                    className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm"
                  >
                    <div className="flex justify-between gap-2">
                      <div>
                        <p className="font-medium text-white">{it.name}</p>
                        <p className="text-xs text-neutral-400">
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
                                className="rounded border border-white/20 px-2 py-1 text-[11px] font-semibold text-white hover:border-teal-500"
                                onClick={() => void applyPriceOverride(it.productId)}
                              >
                                Apply
                              </button>
                              <button
                                type="button"
                                className="rounded border border-white/20 px-2 py-1 text-[11px] font-semibold text-neutral-200 hover:border-white/40"
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
                              className="rounded border border-white/15 px-2 py-1 text-[11px] font-semibold text-neutral-200 hover:border-teal-500 hover:text-white"
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
                          <p className="mt-1 text-xs font-medium text-amber-400">
                            Only {onHandByProductId.get(it.productId) ?? 0} on hand at default branch.
                          </p>
                        ) : null}
                      </div>
                      <p className="shrink-0 font-semibold text-neutral-200">{money(it.lineTotal)}</p>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        className="rounded border border-white/20 px-2 py-1 text-xs text-white hover:border-teal-500"
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
                        className="rounded border border-white/20 px-2 py-1 text-xs text-white hover:border-teal-500"
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
                        className="ml-auto text-xs font-semibold text-neutral-400 hover:text-white"
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

          <div className="border-t border-white/10 p-4 space-y-4">
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-200/90">iDeliver</h3>
                <Link
                  href="/dashboard/settings?tab=ideliver"
                  className="text-[10px] font-semibold text-teal-600 hover:underline"
                >
                  Configure staff &amp; fares
                </Link>
              </div>
              <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-neutral-200">
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
                    <label className="block text-[10px] font-medium text-neutral-400" htmlFor="ideliver-staff">
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
                      <p className="mt-1 text-[10px] text-amber-300/90">
                        Add named providers under Settings → iDeliver to enable selection.
                      </p>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-medium text-neutral-400" htmlFor="ideliver-km">
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
                      <p className="text-[10px] text-neutral-500">Computed fare</p>
                      <p className="font-mono text-sm font-semibold text-white">{money(deliveryFeePreview)}</p>
                    </div>
                  </div>
                  <label className="flex cursor-pointer items-start gap-2 text-xs text-neutral-200">
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
                      <span className="mt-1 block text-[10px] text-neutral-500">
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

            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-200/90">COGS Reserves</h3>
                <Link
                  href="/dashboard/financial?tab=seed"
                  className="text-[10px] font-semibold text-teal-600 hover:underline"
                >
                  Seed Account
                </Link>
              </div>
              <p className="mt-2 flex items-baseline justify-between gap-2 text-sm">
                <span className="text-neutral-300">Estimated COGS (cart)</span>
                <span className="font-mono font-semibold text-white">{money(estimatedCartCogs)}</span>
              </p>
              <p className="mt-2 text-[10px] leading-relaxed text-neutral-500">
                Landed unit cost × qty posts to the COGS Reserves ledger when you complete the sale (isolated from
                revenue).
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-neutral-400">Goods</span>
                <span className="font-semibold text-white">{money(cart.subtotal)}</span>
              </div>
              {cart.delivery.enabled ? (
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-neutral-400">Delivery (iDeliver)</span>
                  <span className="font-semibold text-white">{money(deliveryFeePreview)}</span>
                </div>
              ) : null}
              {cartTax.salesTax > 0 ? (
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-neutral-400">
                    {taxSettingsPreview.taxLabel}
                    {taxSettingsPreview.pricesTaxInclusive ? " (in prices)" : " (added)"}
                  </span>
                  <span className="font-semibold text-white">{money(cartTax.salesTax)}</span>
                </div>
              ) : null}
              <div className="flex items-baseline justify-between border-t border-white/10 pt-2">
                <span className="text-sm font-medium text-neutral-200">Amount due</span>
                <span className="text-lg font-semibold text-teal-600">{money(amountDue)}</span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-neutral-300" htmlFor="pay-method">
                  Payment
                </label>
                <select
                  id="pay-method"
                  title="Payment method"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="vendor-field mt-1 w-full rounded-lg px-2 py-2 text-sm"
                >
                  {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((m) => (
                    <option key={m} value={m}>
                      {PAYMENT_LABELS[m]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-300" htmlFor="tender">
                  Amount tendered
                </label>
                <input
                  id="tender"
                  type="number"
                  min={0}
                  step="any"
                  inputMode="decimal"
                  placeholder={amountDue > 0 ? amountDue.toFixed(2) : "0.00"}
                  value={tenderInput}
                  onChange={(e) => setTenderInput(e.target.value)}
                  className="vendor-field mt-1 w-full rounded-lg px-2 py-2 text-sm"
                />
              </div>
            </div>

            {status ? <p className="text-xs text-neutral-300">{status}</p> : null}

            <button
              type="button"
              disabled={cart.items.length === 0 || hasInsufficientStock || !hasTradingShop}
              onClick={completeSale}
              className="w-full rounded-lg bg-teal-600 py-3 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-40"
            >
              Complete sale
            </button>
            {hasInsufficientStock ? (
              <p className="text-xs text-amber-400">
                Reduce quantities to match on-hand stock before completing.
              </p>
            ) : null}
            <p className="text-[11px] text-neutral-400">
              Sale saves to <span className="font-mono">seigen.pos:v1:sales</span>. COGS posts to{" "}
              <span className="font-mono">{cogsReservesLedgerStorageKey()}</span>. Delivery fees credit the selected
              provider in <span className="font-mono">seigen.pos:v1:ideliver_ledger</span> for payout / COA mapping.
            </p>

            <PosReceiptBrandingPanel />
          </div>
        </section>

        <div className="flex w-full flex-col gap-4 lg:shrink-0">
          <PosSalesHistory
            refreshTrigger={salesTick}
            pinnedSale={pinnedReceipt}
            onDismissPin={() => setPinnedReceipt(null)}
          />
        </div>
      </div>
    </>
  );
}
