export const metadata = { title: "Inventory" };

import { Suspense } from "react";
import { InventoryOverview } from "@/modules/inventory/ui/inventory-overview";

export default function InventoryPage() {
  return (
    <Suspense fallback={<div className="flex-1 px-4 py-8 text-sm text-neutral-700 sm:px-6">Loading inventory…</div>}>
      <InventoryOverview />
    </Suspense>
  );
}
