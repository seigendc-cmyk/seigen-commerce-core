"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardTopBar } from "@/components/dashboard/dashboard-top-bar";
import { posSalesStorageKey } from "@/modules/pos/services/sales-service";
import { InventoryRepo, inventoryKeys } from "../services/inventory-repo";
import { listProductReadModels } from "../services/product-read-model";
import { PurchasingService, purchasingKeys } from "../services/purchasing-service";
import { ReceivingService, receivingKeys } from "../services/receiving-service";
import { listStocktakeSessions } from "../services/stocktake-service";
import type { ProductReadModel } from "../types/product-read-model";
import { INVENTORY_TAB_QUERY_ITEM_LIST, INVENTORY_TAB_QUERY_STOCKTAKE } from "../inventory-nav";
import { InventoryBranchesPanel } from "./inventory-branches-panel";
import { InventoryProductCatalogTab } from "./inventory-product-catalog-tab";
import { InventoryStocktakeTab } from "./inventory-stocktake-tab";

type Snapshot = {
  rows: ProductReadModel[];
  poCount: number;
  outstandingPoCount: number;
  receiptCount: number;
  stocktakeSessionCount: number;
};

function readSnapshot(): Snapshot {
  const branch = InventoryRepo.getDefaultTradingBranch() ?? InventoryRepo.getDefaultBranch();
  const pos = PurchasingService.listPurchaseOrders();
  const outstandingPoCount = pos.filter(
    (po) =>
      (po.status === "ordered" || po.status === "partially_received") && po.items.length > 0,
  ).length;
  return {
    rows: listProductReadModels(branch.id),
    poCount: pos.length,
    outstandingPoCount,
    receiptCount: ReceivingService.listReceipts().length,
    stocktakeSessionCount: listStocktakeSessions(500).length,
  };
}

type InventoryTab = "overview" | "catalog" | "stocktake";

export function InventoryOverview() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");
  const tab: InventoryTab =
    rawTab === INVENTORY_TAB_QUERY_ITEM_LIST || rawTab === "catalog"
      ? "catalog"
      : rawTab === INVENTORY_TAB_QUERY_STOCKTAKE
        ? "stocktake"
        : "overview";

  const selectTab = (id: InventoryTab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id === "catalog") {
      params.set("tab", INVENTORY_TAB_QUERY_ITEM_LIST);
    } else if (id === "stocktake") {
      params.set("tab", INVENTORY_TAB_QUERY_STOCKTAKE);
    } else {
      params.delete("tab");
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const [snap, setSnap] = useState<Snapshot>(() => ({
    rows: [],
    poCount: 0,
    outstandingPoCount: 0,
    receiptCount: 0,
    stocktakeSessionCount: 0,
  }));

  const refreshSnapshot = useCallback(() => setSnap(readSnapshot()), []);

  useEffect(() => {
    refreshSnapshot();
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (
        e.key === inventoryKeys.db ||
        e.key === purchasingKeys.purchasing ||
        e.key === receivingKeys.receiving ||
        e.key === posSalesStorageKey
      ) {
        refreshSnapshot();
      }
    };
    const onLocalActivity = () => refreshSnapshot();
    window.addEventListener("storage", onStorage);
    window.addEventListener("seigen-stocktake-posted", onLocalActivity);
    window.addEventListener("seigen-pos-sale-recorded", onLocalActivity);
    window.addEventListener("seigen-inventory-branches-updated", onLocalActivity);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("seigen-stocktake-posted", onLocalActivity);
      window.removeEventListener("seigen-pos-sale-recorded", onLocalActivity);
      window.removeEventListener("seigen-inventory-branches-updated", onLocalActivity);
    };
  }, [refreshSnapshot]);

  const lowStock = useMemo(() => snap.rows.filter((r) => r.onHandQty <= 0), [snap.rows]);

  return (
    <>
      <DashboardTopBar
        title="Inventory"
        subtitle="Trading shops hold stock and ring sales; Head office is admin-only and is not a billable shop."
      />
      <div className="flex-1 space-y-8 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap gap-2 border-b border-neutral-900/15 pb-4">
          {(
            [
              { id: "overview" as const, label: "Overview" },
              { id: "catalog" as const, label: "Item List" },
              { id: "stocktake" as const, label: "Stocktake" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => selectTab(t.id)}
              className={
                tab === t.id
                  ? "vendor-seg-tab vendor-seg-tab-active"
                  : "vendor-seg-tab vendor-seg-tab-inactive"
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "catalog" ? (
          <InventoryProductCatalogTab rows={snap.rows} />
        ) : null}

        {tab === "stocktake" ? <InventoryStocktakeTab onPosted={refreshSnapshot} /> : null}

        {tab === "overview" ? (
          <>
        <InventoryBranchesPanel />

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {[
            {
              title: "Products",
              value: snap.rows.length,
              href: "/dashboard/inventory/add-product",
              cta: "Add product",
            },
            {
              title: "Zero stock",
              value: lowStock.length,
              href: "/dashboard/inventory/receiving",
              cta: "Receive goods",
            },
            {
              title: "Purchase orders",
              value: snap.poCount,
              href: "/dashboard/inventory/purchasing",
              cta: "Create PO",
            },
            {
              title: "Outstanding orders",
              value: snap.outstandingPoCount,
              href: "/dashboard/inventory/receiving",
              cta: "Receive goods",
            },
            {
              title: "Receipts",
              value: snap.receiptCount,
              href: "/dashboard/inventory/receiving",
              cta: "View receiving",
            },
            {
              title: "Stocktake sessions",
              value: snap.stocktakeSessionCount,
              href: `/dashboard/inventory?tab=${INVENTORY_TAB_QUERY_STOCKTAKE}`,
              cta: "Count stock",
            },
          ].map((card) => (
            <div key={card.title} className="vendor-panel rounded-2xl p-5">
              <p className="text-sm font-medium text-neutral-300">{card.title}</p>
              <p className="mt-2 text-3xl font-semibold text-white">{card.value}</p>
              <Link
                href={card.href}
                className="mt-4 inline-block text-sm font-semibold text-teal-600 hover:underline"
              >
                {card.cta} →
              </Link>
            </div>
          ))}
        </section>

        <section className="vendor-panel-soft rounded-2xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-white">Quick actions</h2>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/dashboard/inventory/add-product"
                className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700"
              >
                Add product
              </Link>
              <Link
                href="/dashboard/inventory/purchasing"
                className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:border-teal-500 hover:text-teal-600"
              >
                Purchasing
              </Link>
              <Link
                href="/dashboard/inventory/receiving"
                className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:border-teal-500 hover:text-teal-600"
              >
                Receiving
              </Link>
            </div>
          </div>
        </section>

        <section className="vendor-panel-soft rounded-2xl p-6">
          <h2 className="text-base font-semibold text-white">Product list</h2>
          <p className="mt-1 text-sm text-neutral-300">
            Browse every product with customizable columns and multi-word search on the{" "}
            <button
              type="button"
              onClick={() => selectTab("catalog")}
              className="font-semibold text-teal-600 hover:underline"
            >
              Item List
            </button>{" "}
            tab.
          </p>
        </section>

        <section className="vendor-panel-soft rounded-2xl p-6">
          <h2 className="text-base font-semibold text-white">Attention</h2>
          <p className="mt-2 text-sm text-neutral-300">Products with zero on-hand at the default branch.</p>
          {lowStock.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-200">None — all tracked products have stock.</p>
          ) : (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {lowStock.slice(0, 12).map((r) => (
                <li key={r.id} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <p className="text-sm font-semibold text-white">{r.name}</p>
                  <p className="text-xs text-neutral-400">
                    {r.sku} · Stock {r.onHandQty}
                  </p>
                  <Link
                    href={`/dashboard/inventory/edit-product/${r.id}`}
                    className="mt-2 inline-block text-xs font-semibold text-teal-600 hover:underline"
                  >
                    Edit →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
          </>
        ) : null}
      </div>
    </>
  );
}
