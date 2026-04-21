import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type PolicySimulationInput =
  | {
      kind: "threshold_change";
      permissionKey: string;
      thresholdType: "amount" | "variance";
      currentThreshold: number;
      proposedThreshold: number;
      windowDays: number;
    }
  | {
      kind: "require_approval_toggle";
      permissionKey: string;
      windowDays: number;
      proposedRequiresApproval: boolean;
    };

export type PolicySimulationResult = {
  baseline: {
    eventsObserved: number;
    approvalsEstimated: number;
    denialsObserved: number;
  };
  proposed: {
    approvalsEstimated: number;
    notes: string[];
  };
  delta: {
    approvalsEstimated: number;
  };
  warnings: string[];
};

/**
 * Simulation is isolated and non-destructive. It uses recent signals as a proxy for “likely volume”.
 * This is rule-based and explainable by design.
 */
export async function runPolicySimulation(input: PolicySimulationInput, tenantId: string): Promise<{ ok: true; result: PolicySimulationResult } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const since = new Date(Date.now() - input.windowDays * 24 * 60 * 60_000).toISOString();

  const [{ data: denials, count: denialCount }] = await Promise.all([
    supabase.from("permission_denial_events").select("id", { count: "exact" }).eq("tenant_id", tenantId).eq("permission_key", input.permissionKey).gte("created_at", since),
  ]);

  const denialsObserved = denialCount ?? (denials?.length ?? 0);

  // Baseline approvals proxy: existing approval execution links OR approval requests (Pack 5)
  const [{ count: approvalLinks }] = await Promise.all([
    supabase.from("approval_execution_links").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("permission_key", input.permissionKey).gte("created_at", since),
  ]);

  const baselineApprovals = approvalLinks ?? 0;

  const baseline: PolicySimulationResult["baseline"] = {
    eventsObserved: denialsObserved + baselineApprovals,
    approvalsEstimated: baselineApprovals,
    denialsObserved,
  };

  const warnings: string[] = [];
  const notes: string[] = [];

  let proposedApprovals = baselineApprovals;
  if (input.kind === "require_approval_toggle") {
    proposedApprovals = input.proposedRequiresApproval ? Math.max(baselineApprovals, Math.ceil(baseline.eventsObserved * 0.6)) : Math.floor(baselineApprovals * 0.2);
    notes.push(input.proposedRequiresApproval ? "Assumes most attempts would route to approvals." : "Assumes most approvals would be removed for this permission.");
    warnings.push("This is an estimate based on recent governance signals, not a guarantee.");
  } else if (input.kind === "threshold_change") {
    const ratio = input.currentThreshold > 0 ? input.proposedThreshold / input.currentThreshold : 1;
    // crude inverse relationship: higher threshold => fewer approvals
    proposedApprovals = Math.max(0, Math.round(baselineApprovals / Math.max(0.2, ratio)));
    notes.push(`Threshold moved from ${input.currentThreshold} → ${input.proposedThreshold}.`);
    warnings.push("Threshold simulation uses a simple inverse model; refine when action telemetry exists per amount/variance.");
  }

  const proposed: PolicySimulationResult["proposed"] = { approvalsEstimated: proposedApprovals, notes };
  return {
    ok: true,
    result: {
      baseline,
      proposed,
      delta: { approvalsEstimated: proposedApprovals - baselineApprovals },
      warnings,
    },
  };
}

