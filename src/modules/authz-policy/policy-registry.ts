import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ExecutionPolicyRow, ThresholdType } from "./types";

/** In-memory fallback when DB unavailable or row missing (mirrors migration seed). */
export const STATIC_DEFAULT_POLICIES: ExecutionPolicyRow[] = [
  mk("pos.price.override", { requiresReason: true }),
  mk("pos.price.floor_override", {
    requiresReason: true,
    requiresApproval: true,
    approvalPolicyCode: "default_manager",
    thresholdType: "margin_delta",
    thresholdValue: 0,
  }),
  mk("pos.return.full", { requiresReason: true }),
  mk("pos.sale.void", { requiresReason: true, requiresApproval: true, approvalPolicyCode: "default_manager" }),
  mk("pos.sale.reopen", { requiresApproval: true, approvalPolicyCode: "default_manager" }),
  mk("pos.cash_movement.cash_out", { requiresApproval: true, requiresStepUp: true, approvalPolicyCode: "default_manager", stepUpPolicyCode: "supervisor_passcode", thresholdType: "amount", thresholdValue: 500 }),
  mk("inventory.adjustment.post", { requiresApproval: true, approvalPolicyCode: "inventory_threshold", thresholdType: "variance", thresholdValue: 100 }),
  mk("inventory.variance.post", { requiresReason: true, requiresApproval: true, approvalPolicyCode: "inventory_threshold", thresholdType: "variance", thresholdValue: 50 }),
  mk("inventory.product.delete", { requiresReason: true, requiresStepUp: true, requiresApproval: true, approvalPolicyCode: "default_sysadmin", stepUpPolicyCode: "manager_confirmation" }),
  mk("finance.period.reopen", { requiresReason: true, requiresStepUp: true, requiresApproval: true, approvalPolicyCode: "finance_controller", stepUpPolicyCode: "re_auth_future" }),
  mk("approval.request.override", { requiresReason: true, requiresStepUp: true, requiresApproval: true, approvalPolicyCode: "default_sysadmin", stepUpPolicyCode: "dual_control_confirmation" }),
  mk("system.roles.assign", { requiresReason: true, requiresApproval: true, approvalPolicyCode: "default_sysadmin" }),
  mk("system.roles.manage", { requiresReason: true, requiresApproval: true, approvalPolicyCode: "default_sysadmin" }),
  mk("system.audit.export", { requiresReason: true }),
  mk("security.policy.manage", { requiresReason: true, requiresStepUp: true, requiresApproval: true, approvalPolicyCode: "default_sysadmin", stepUpPolicyCode: "otp_future" }),
  mk("security.mfa.manage", { requiresReason: true, requiresStepUp: true, stepUpPolicyCode: "otp_future" }),
  mk("security.session.force_logout", { requiresReason: true }),
  mk("delivery.dispatch.cancel", { requiresApproval: true, approvalPolicyCode: "default_manager", appliesWhenJson: { dispatchAssigned: true } }),
];

function mk(permissionKey: string, patch: Partial<ExecutionPolicyRow>): ExecutionPolicyRow {
  return {
    id: `static-${permissionKey}`,
    tenantId: null,
    permissionKey,
    requiresReason: false,
    requiresStepUp: false,
    requiresApproval: false,
    approvalPolicyCode: null,
    stepUpPolicyCode: null,
    thresholdType: null,
    thresholdValue: null,
    appliesWhenJson: null,
    riskLevelOverride: null,
    isActive: true,
    ...patch,
  };
}

function mapRow(r: Record<string, unknown>): ExecutionPolicyRow {
  return {
    id: String(r.id),
    tenantId: (r.tenant_id as string | null) ?? null,
    permissionKey: String(r.permission_key),
    requiresReason: Boolean(r.requires_reason),
    requiresStepUp: Boolean(r.requires_step_up),
    requiresApproval: Boolean(r.requires_approval),
    approvalPolicyCode: (r.approval_policy_code as string | null) ?? null,
    stepUpPolicyCode: (r.step_up_policy_code as string | null) ?? null,
    thresholdType: (r.threshold_type as ThresholdType | null) ?? null,
    thresholdValue: r.threshold_value != null ? Number(r.threshold_value) : null,
    appliesWhenJson: (r.applies_when_json as Record<string, unknown> | null) ?? null,
    riskLevelOverride: (r.risk_level_override as string | null) ?? null,
    isActive: Boolean(r.is_active),
  };
}

/**
 * Tenant-specific row overrides global (tenant_id null) when present.
 */
export async function loadExecutionPolicy(tenantId: string, permissionKey: string): Promise<ExecutionPolicyRow | null> {
  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase
      .from("permission_execution_policies")
      .select("*")
      .eq("permission_key", permissionKey)
      .eq("is_active", true)
      .or(`tenant_id.eq.${tenantId},tenant_id.is.null`);

    const rows = (data ?? []) as Record<string, unknown>[];
    const tenantRow = rows.find((x) => x.tenant_id === tenantId);
    if (tenantRow) return mapRow(tenantRow);
    const global = rows.find((x) => x.tenant_id == null);
    if (global) return mapRow(global);
  }

  return STATIC_DEFAULT_POLICIES.find((p) => p.permissionKey === permissionKey) ?? null;
}

export async function listExecutionPolicies(tenantId: string): Promise<ExecutionPolicyRow[]> {
  const staticKeys = new Map(STATIC_DEFAULT_POLICIES.map((p) => [p.permissionKey, p]));

  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase
      .from("permission_execution_policies")
      .select("*")
      .eq("is_active", true)
      .or(`tenant_id.eq.${tenantId},tenant_id.is.null`);

    const merged = new Map<string, ExecutionPolicyRow>();
    for (const r of (data ?? []) as Record<string, unknown>[]) {
      const row = mapRow(r);
      const pk = row.permissionKey;
      const existing = merged.get(pk);
      if (!existing || row.tenantId) merged.set(pk, row);
    }
    for (const [k, v] of staticKeys) {
      if (!merged.has(k)) merged.set(k, v);
    }
    return Array.from(merged.values()).sort((a, b) => a.permissionKey.localeCompare(b.permissionKey));
  }

  return Array.from(staticKeys.values()).sort((a, b) => a.permissionKey.localeCompare(b.permissionKey));
}
