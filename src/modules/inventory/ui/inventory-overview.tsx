"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DashboardTopBar } from "@/components/dashboard/dashboard-top-bar";
import { InventoryRepo, inventoryKeys } from "../services/inventory-repo";
import { listProductReadModels } from "../services/product-read-model";
import { PurchasingService, purchasingKeys } from "../services/purchasing-service";
import { ReceivingService, receivingKeys } from "../services/receiving-service";
import type { ProductReadModel } from "../types/product-read-model";
import { INVENTORY_TAB_QUERY_ITEM_LIST } from "../inventory-nav";
import { InventoryProductCatalogTab } from "./inventory-product-catalog-tab";

type Snapshot = {
  rows: ProductReadModel[];
  poCount: number;
  receiptCount: number;
};

function readSnapshot(): Snapshot {
  const branch = InventoryRepo.getDefaultBranch();
  return {
    rows: listProductReadModels(branch.id),
    poCount: PurchasingService.listPurchaseOrders().length,
    receiptCount: ReceivingService.listReceipts().length,
  };
}

type InventoryTab = "overview" | "catalog";

export function InventoryOverview() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab: InventoryTab =
    searchParams.get("tab") === INVENTORY_TAB_QUERY_ITEM_LIST || searchParams.get("tab") === "catalog"
      ? "catalog"
      : "overview";

  const selectTab = (id: InventoryTab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id === "catalog") {
      params.set("tab", INVENTORY_TAB_QUERY_ITEM_LIST);
    } else {
      params.delete("tab");
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const [snap, setSnap] = useState<Snapshot>(() => ({
    rows: [],
    poCount: 0,
    receiptCount: 0,
  }));

  useEffect(() => {
    setSnap(readSnapshot());
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (
        e.key === inventoryKeys.db ||
        e.key === purchasingKeys.purchasing ||
        e.key === receivingKeys.receiving
      ) {
        setSnap(readSnapshot());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const lowStock = useMemo(() => snap.rows.filter((r) => r.onHandQty <= 0), [snap.rows]);

  return (
    <>
      <DashboardTopBar
        title="Inventory"
        subtitle="Catalog, pricing, and stock for the default branch — POS reads this shape locally."
      />
      <div className="flex-1 space-y-8 px-4 py-8 sm:px-6">
        <div className="flex flex-wrap gap-2 border-b border-neutral-900/15 pb-4">
          {(
            [
              { id: "overview" as const, label: "Overview" },
              { id: "catalog" as const, label: "Item List" },
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

        {tab === "overview" ? (
          <>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
              title: "Receipts",
              value: snap.receiptCount,
              href: "/dashboard/inventory/receiving",
              cta: "View receiving",
            },
          ].map((card) => (
            <div key={card.title} className="vendor-panel rounded-2xl p-5">
              <p className="text-sm font-medium text-neutral-300">{card.title}</p>
              <p className="mt-2 text-3xl font-semibold text-white">{card.value}</p>
              <Link
                href={card.href}
                className="mt-4 inline-block text-sm font-semibold text-brand-orange hover:underline"
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
                className="rounded-lg bg-brand-orange px-3 py-2 text-sm font-semibold text-white hover:bg-brand-orange-hover"
              >
                Add product
              </Link>
              <Link
                href="/dashboard/inventory/purchasing"
                className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:border-brand-orange hover:text-brand-orange"
              >
                Purchasing
              </Link>
              <Link
                href="/dashboard/inventory/receiving"
                className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:border-brand-orange hover:text-brand-orange"
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
              className="font-semibold text-brand-orange hover:underline"
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
                    className="mt-2 inline-block text-xs font-semibold text-brand-orange hover:underline"
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
