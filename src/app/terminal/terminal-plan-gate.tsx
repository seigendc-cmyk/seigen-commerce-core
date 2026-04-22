"use client";

import { PlanGatedModule } from "@/components/dashboard/plan-gated-module";

export function TerminalPlanGate({ children }: { children: React.ReactNode }) {
  return <PlanGatedModule area="pos">{children}</PlanGatedModule>;
}
