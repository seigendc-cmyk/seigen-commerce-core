import type { WorkflowImpactSummary } from "./types";

/**
 * Policy-driven visibility flags.
 * Pack 6: conservative defaults based on impact summary and permission families.
 */
export function resolveVisibility(input: {
  permissionKey: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  impact: WorkflowImpactSummary;
}): { executiveVisible: boolean; trustVisible: boolean; mode: "visibility_only" | "approval_required" } {
  const pk = input.permissionKey;
  const exec = Boolean(input.impact.executiveVisibilitySuggested) || input.riskLevel === "critical";
  const trust = Boolean(input.impact.trustVisibilitySuggested) || pk.startsWith("security.") || pk.startsWith("system.audit");
  // Pack 6 distinguishes visibility from approval; actual approval rules remain in Pack 4/5.
  return { executiveVisible: exec, trustVisible: trust, mode: "visibility_only" };
}

