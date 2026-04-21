import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function insertPermissionDenialEvent(input: {
  tenantId: string;
  userId: string;
  permissionKey: string;
  reasonCode: string;
  scopeEntityType?: string | null;
  scopeEntityId?: string | null;
  deskCode?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  contextJson?: Record<string, unknown>;
}): Promise<{ ok: true; id: string } | { ok: false }> {
  if (!isSupabaseConfigured()) return { ok: false };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("permission_denial_events")
    .insert({
      tenant_id: input.tenantId,
      user_id: input.userId,
      permission_key: input.permissionKey,
      reason_code: input.reasonCode,
      scope_entity_type: input.scopeEntityType ?? null,
      scope_entity_id: input.scopeEntityId ?? null,
      desk_code: input.deskCode ?? null,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      context_json: input.contextJson ?? {},
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false };
  return { ok: true, id: data.id as string };
}

export async function insertStepUpEvent(input: {
  tenantId: string;
  userId: string;
  permissionKey: string;
  actionCode: string;
  entityType: string;
  entityId?: string | null;
  stepUpPolicyCode: string;
  status: "required" | "completed" | "failed" | "expired" | "bypassed";
  reason?: string | null;
  metadata?: Record<string, unknown>;
  expiresAt?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false }> {
  if (!isSupabaseConfigured()) return { ok: false };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("step_up_events")
    .insert({
      tenant_id: input.tenantId,
      user_id: input.userId,
      permission_key: input.permissionKey,
      action_code: input.actionCode,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      step_up_policy_code: input.stepUpPolicyCode,
      status: input.status,
      reason: input.reason ?? null,
      metadata: input.metadata ?? {},
      expires_at: input.expiresAt ?? null,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false };
  return { ok: true, id: data.id as string };
}

export async function updateStepUpEventStatus(
  id: string,
  patch: { status: "completed" | "failed" | "expired" | "bypassed"; verifiedByUserId?: string | null },
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("step_up_events")
    .update({
      status: patch.status,
      verified_by_user_id: patch.verifiedByUserId ?? null,
    })
    .eq("id", id);
  return !error;
}

export async function insertApprovalExecutionLink(input: {
  tenantId: string;
  permissionKey: string;
  actionCode: string;
  entityType: string;
  entityId?: string | null;
  requestingUserId: string;
  approvalRequestRef: string;
  status: "pending" | "approved" | "rejected" | "cancelled" | "executed";
  metadata?: Record<string, unknown>;
}): Promise<{ ok: true; id: string } | { ok: false }> {
  if (!isSupabaseConfigured()) return { ok: false };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("approval_execution_links")
    .insert({
      tenant_id: input.tenantId,
      permission_key: input.permissionKey,
      action_code: input.actionCode,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      requesting_user_id: input.requestingUserId,
      approval_request_ref: input.approvalRequestRef,
      status: input.status,
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false };
  return { ok: true, id: data.id as string };
}

export async function updateApprovalExecutionLinkStatus(
  approvalRequestRef: string,
  tenantId: string,
  status: "pending" | "approved" | "rejected" | "cancelled" | "executed",
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("approval_execution_links")
    .update({ status })
    .eq("tenant_id", tenantId)
    .eq("approval_request_ref", approvalRequestRef);
  return !error;
}
