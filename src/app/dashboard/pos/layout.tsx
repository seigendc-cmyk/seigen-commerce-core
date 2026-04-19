"use client";

import { PlanGatedModule } from "@/components/dashboard/plan-gated-module";

export default function PosLayout({ children }: { children: React.ReactNode }) {
  return <PlanGatedModule area="pos">{children}</PlanGatedModule>;
}
