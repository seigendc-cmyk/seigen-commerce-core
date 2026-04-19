"use client";

import { PlanGatedModule } from "@/components/dashboard/plan-gated-module";

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  return <PlanGatedModule area="inventory">{children}</PlanGatedModule>;
}
