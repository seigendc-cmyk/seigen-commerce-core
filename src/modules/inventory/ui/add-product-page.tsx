"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DashboardTopBar } from "@/components/dashboard/dashboard-top-bar";
import { HREF_INVENTORY_ITEM_LIST } from "../inventory-nav";
import { InventoryRepo } from "../services/inventory-repo";
import { ProductForm } from "./product-form";

export function AddProductPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <DashboardTopBar title="Add product" subtitle="Create a product locally. Sector fields adjust automatically." />
      <div className="flex-1 px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/dashboard/inventory" className="text-sm font-semibold text-teal-600 hover:underline">
              ← Back to inventory
            </Link>
          </div>

          {error ? (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              {error}
            </div>
          ) : null}

          <ProductForm
            submitLabel="Add product"
            onSubmit={(payload) => {
              setError(null);
              try {
                InventoryRepo.addProduct(payload);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Could not add product.");
                return;
              }
              router.push(HREF_INVENTORY_ITEM_LIST);
            }}
          />
        </div>
      </div>
    </>
  );
}
