"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DashboardTopBar } from "@/components/dashboard/dashboard-top-bar";
import { HREF_INVENTORY_ITEM_LIST } from "../inventory-nav";
import { InventoryRepo } from "../services/inventory-repo";
import {
  getOnHandForProduct,
  getOnHandSumForSkuAtBranch,
  getProductReadModel,
} from "../services/product-read-model";
import { AssemblyOperationsPanel } from "./assembly-operations-panel";
import { ProductForm } from "./product-form";

type Props = { productId: string };

export function EditProductPage({ productId }: Props) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [stockQty, setStockQty] = useState(0);
  const [opTick, setOpTick] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const refreshStock = useCallback(() => {
    const p = InventoryRepo.getProduct(productId);
    if (!p) return;
    const branch = InventoryRepo.getDefaultTradingBranch() ?? InventoryRepo.getDefaultBranch();
    setStockQty(
      p.sku.trim()
        ? getOnHandSumForSkuAtBranch(branch.id, p.sku)
        : getOnHandForProduct(branch.id, productId),
    );
    setOpTick((t) => t + 1);
  }, [productId]);

  useEffect(() => {
    const p = InventoryRepo.getProduct(productId);
    if (!p) {
      router.replace("/dashboard/inventory");
      return;
    }
    refreshStock();
    setReady(true);
  }, [productId, router, refreshStock]);

  const product = InventoryRepo.getProduct(productId);
  const read = getProductReadModel(productId);
  void opTick;

  if (!ready || !product) {
    return (
      <>
        <DashboardTopBar title="Edit product" subtitle="Loading…" />
        <div className="flex-1 px-4 py-8 sm:px-6">
          <p className="text-sm text-neutral-300">Loading product…</p>
        </div>
      </>
    );
  }

  return (
    <>
      <DashboardTopBar
        title="Edit product"
        subtitle={`${read?.sku ?? product.sku} · Stock (default branch): ${stockQty} ${product.unit}`}
      />
      <div className="flex-1 px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/dashboard/inventory" className="text-sm font-semibold text-brand-orange hover:underline">
              ← Back to inventory
            </Link>
          </div>

          <div className="vendor-panel-soft rounded-2xl px-4 py-3 text-sm text-neutral-300">
            <span className="font-medium text-neutral-200">Item code:</span> {product.sku} ·{" "}
            <span className="font-medium text-neutral-200">Sector:</span> {read?.sectorLabel ?? product.sectorId} ·{" "}
            <span className="font-medium text-neutral-200">Status:</span> {product.active ? "Active" : "Inactive"}
          </div>

          {error ? (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              {error}
            </div>
          ) : null}

          <ProductForm
            initial={product}
            submitLabel="Save changes"
            onSubmit={(payload) => {
              setError(null);
              try {
                InventoryRepo.updateProduct(productId, payload);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Could not save changes.");
                return;
              }
              router.push(HREF_INVENTORY_ITEM_LIST);
            }}
          />

          <AssemblyOperationsPanel product={product} onDone={refreshStock} />
        </div>
      </div>
    </>
  );
}
