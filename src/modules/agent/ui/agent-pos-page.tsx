"use client";

import { useEffect, useMemo, useState } from "react";
import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";
import type { AgentContext } from "@/modules/agent/ui/agent-gate";
import { PosPage } from "@/modules/pos/ui/pos-page";

export function AgentPosPage({ ctx }: { ctx: AgentContext }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Lock POS scope to the agent stall branch for this session.
    InventoryRepo.setDefaultBranch(ctx.stallBranchId);
    setReady(true);
  }, [ctx.stallBranchId]);

  const stallName = useMemo(() => InventoryRepo.getBranch(ctx.stallBranchId)?.name ?? "Agent stall", [ctx.stallBranchId]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
        POS Terminal locked to: <span className="font-semibold text-slate-900">{stallName}</span>
      </div>
      {ready ? <PosPage /> : null}
    </div>
  );
}

