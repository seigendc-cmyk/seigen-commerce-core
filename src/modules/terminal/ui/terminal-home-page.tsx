"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { InventoryRepo, inventoryKeys } from "@/modules/inventory/services/inventory-repo";
import { listProductReadModels } from "@/modules/inventory/services/product-read-model";
import type { ProductReadModel } from "@/modules/inventory/types/product-read-model";
import { addOrIncrementFromProduct } from "@/modules/pos/services/cart-service";
import { useTerminalSession } from "../state/terminal-session-context";
import { useTerminalCart } from "../state/terminal-cart-context";

function blockedReason(p: ProductReadModel): string | null {
  if (!p.active) return "Inactive in catalog.";
  if (p.forSale === false) return "Not for sale.";
  if (p.onHandQty < 1) return "No stock on hand.";
  return null;
}

export function TerminalHomePage() {
  const { profile, openShift, terminalAllows } = useTerminalSession();
  const { cart, setCart } = useTerminalCart();
  const [search, setSearch] = useState("");
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [status, setStatus] = useState<string | null>(null);

  const refreshCatalog = useCallback(() => setCatalogVersion((v) => v + 1), []);

  useEffect(() => {
    const onSale = () => refreshCatalog();
    const onStorage = (e: StorageEvent) => {
      if (e.key === inventoryKeys.db()) refreshCatalog();
    };
    const onVis = () => {
      if (document.visibilityState === "visible") refreshCatalog();
    };
    window.addEventListener("seigen-pos-sale-recorded", onSale);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("seigen-pos-sale-recorded", onSale);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refreshCatalog]);

  const branchId = profile?.branchId;
  const catalog = useMemo(() => {
    void catalogVersion;
    if (!branchId) return [];
    return listProductReadModels(branchId);
  }, [catalogVersion, branchId]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    const active = catalog.filter((p) => p.active);
    if (!q) return active.slice(0, 36);
    return active
      .filter(
        (p) =>
          p.sku.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          (p.barcode?.toLowerCase().includes(q) ?? false),
      )
      .slice(0, 36);
  }, [catalog, search]);

  function addProduct(p: ProductReadModel) {
    if (!openShift) {
      setStatus("Open a shift before selling.");
      return;
    }
    if (!terminalAllows("terminal.sale.create")) {
      setStatus("This terminal is not allowed to create sales.");
      return;
    }
    const blocked = blockedReason(p);
    if (blocked) {
      setStatus(blocked);
      return;
    }
    setCart((c) => addOrIncrementFromProduct(c, p, 1));
    setStatus(`${p.name} added`);
    setTimeout(() => setStatus(null), 2000);
  }

  const cartCount = cart.items.reduce((n, i) => n + i.qty, 0);

  return (
    <div className="px-3 py-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="term-search">
          Scan or search
        </label>
        <input
          id="term-search"
          className="vendor-field mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none ring-orange-500/30 focus:ring-2"
          placeholder="SKU, name, barcode…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoComplete="off"
        />
        {status ? <p className="mt-2 text-sm text-orange-700">{status}</p> : null}
        <p className="mt-2 text-xs text-slate-500">
          Cart {cartCount} line(s) · branch stock from{" "}
          <span className="font-semibold text-slate-700">
            {branchId ? InventoryRepo.getBranch(branchId)?.name ?? branchId : "—"}
          </span>
        </p>
      </div>

      <ul className="mt-4 space-y-2">
        {matches.map((p) => {
          const blocked = blockedReason(p);
          return (
            <li key={p.id}>
              <button
                type="button"
                disabled={!!blocked || !openShift}
                onClick={() => addProduct(p)}
                className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm active:scale-[0.99] disabled:opacity-45"
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold text-slate-900">{p.name}</span>
                  <span className="text-xs text-slate-500">
                    {p.sku} · on hand {p.onHandQty} · {p.sellingPrice.toFixed(2)}
                  </span>
                  {blocked ? <span className="text-xs text-red-600">{blocked}</span> : null}
                </div>
                <span className="rounded-full bg-orange-500 px-3 py-1.5 text-xs font-bold text-white">Add</span>
              </button>
            </li>
          );
        })}
      </ul>
      {matches.length === 0 ? (
        <p className="mt-8 text-center text-sm text-slate-500">No products match this search.</p>
      ) : null}
    </div>
  );
}
