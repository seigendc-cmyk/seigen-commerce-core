import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { GovernanceAuditInput } from "./types";

export async function logGovernanceEvent(input: GovernanceAuditInput): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("permission_audit_logs")
    .insert({
      tenant_id: input.tenantId,
      actor_user_id: input.actorUserId,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      action_code: input.actionCode,
      old_value: input.oldValue ?? null,
      new_value: input.newValue ?? null,
      reason: input.reason ?? null,
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Failed to write audit log" };
  return { ok: true, id: data.id as string };
}

export async function logRoleAssignment(input: Omit<GovernanceAuditInput, "actionCode" | "entityType"> & { entityId: string }) {
  return logGovernanceEvent({ ...input, entityType: "user_role", actionCode: "role_assigned" });
}

export async function logRoleRemoval(input: Omit<GovernanceAuditInput, "actionCode" | "entityType"> & { entityId: string }) {
  return logGovernanceEvent({ ...input, entityType: "user_role", actionCode: "role_removed" });
}

export async function logPrimaryRoleChange(input: Omit<GovernanceAuditInput, "actionCode" | "entityType"> & { entityId: string }) {
  return logGovernanceEvent({ ...input, entityType: "user_role", actionCode: "primary_role_changed" });
}

export async function logOverrideApplied(input: Omit<GovernanceAuditInput, "actionCode" | "entityType"> & { entityId: string }) {
  return logGovernanceEvent({ ...input, entityType: "user_permission_override", actionCode: "override_applied" });
}

export async function logOverrideRemoved(input: Omit<GovernanceAuditInput, "actionCode" | "entityType"> & { entityId: string }) {
  return logGovernanceEvent({ ...input, entityType: "user_permission_override", actionCode: "override_removed" });
}

