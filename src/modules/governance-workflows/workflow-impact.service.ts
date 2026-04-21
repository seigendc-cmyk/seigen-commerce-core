import type { WorkflowImpactSummary } from "./types";

export function computeWorkflowImpact(input: {
  permissionKey: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  amount?: number;
  variance?: number;
}): WorkflowImpactSummary {
  const modules = new Set<string>();
  const notes: string[] = [];
  const pk = input.permissionKey;

  const module = pk.split(".")[0] ?? "governance";
  modules.add(module);

  if (pk.startsWith("inventory.")) {
    modules.add("inventory");
    if (input.variance != null) notes.push(`Variance: ${input.variance}`);
    if (input.amount != null) modules.add("finance");
  }
  if (pk.startsWith("finance.")) {
    modules.add("finance");
    modules.add("audit");
  }
  if (pk.startsWith("system.") || pk.startsWith("security.")) {
    modules.add("security");
    modules.add("governance");
  }
  if (pk.startsWith("pos.")) {
    modules.add("pos");
    modules.add("branch");
  }

  const executiveVisibilitySuggested = input.riskLevel === "critical" || pk === "finance.period.reopen" || pk === "system.audit.export";
  const trustVisibilitySuggested = pk.startsWith("security.") || pk.startsWith("system.audit") || pk === "finance.period.reopen";

  return {
    modulesAffected: Array.from(modules),
    financialExposure: input.amount,
    inventoryExposureQty: input.variance != null ? Math.abs(input.variance) : undefined,
    securitySensitive: pk.startsWith("security.") || pk.startsWith("system.roles"),
    auditSensitive: pk.includes("audit") || input.riskLevel === "critical",
    executiveVisibilitySuggested,
    trustVisibilitySuggested,
    notes,
  };
}

