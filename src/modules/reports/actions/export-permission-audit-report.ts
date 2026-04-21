"use server";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";
import { authorizeForCurrentUser } from "@/modules/authz/authorization-guard";
import { logGovernanceEvent } from "@/modules/authz/audit-log.service";

export async function exportPermissionAuditReport(input?: { from?: string; to?: string; limit?: number; reason?: string }) {
  const ws = await getDashboardWorkspace();
  const actor = await getServerAuthUser();
  if (!ws?.tenant?.id || !actor) return { ok: false as const, error: "Not signed in / no workspace" };

  const authz = await authorizeForCurrentUser({
    permissionKey: "system.audit.export",
    scopeEntityType: "desk",
    scopeCode: "sysadmin_desk",
    critical: { reason: input?.reason ?? "Export permission audit report" },
  });
  if (!authz.allowed) {
    await logGovernanceEvent({
      actorUserId: actor.id,
      tenantId: ws.tenant.id,
      entityType: "permission_audit_logs",
      entityId: null,
      actionCode: "audit_export_denied",
      oldValue: null,
      newValue: { from: input?.from ?? null, to: input?.to ?? null, limit: input?.limit ?? null },
      reason: input?.reason ?? null,
      metadata: { denied: authz },
    });
    return { ok: false as const, denied: authz };
  }

  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();

  let q = supabase
    .from("permission_audit_logs")
    .select("id, tenant_id, actor_user_id, entity_type, entity_id, action_code, old_value, new_value, reason, metadata, created_at")
    .eq("tenant_id", ws.tenant.id)
    .order("created_at", { ascending: false })
    .limit(Math.min(5000, Math.max(1, input?.limit ?? 500)));

  if (input?.from) q = q.gte("created_at", input.from);
  if (input?.to) q = q.lte("created_at", input.to);

  const { data, error } = await q;
  if (error) return { ok: false as const, error: error.message };

  await logGovernanceEvent({
    actorUserId: actor.id,
    tenantId: ws.tenant.id,
    entityType: "permission_audit_logs",
    entityId: null,
    actionCode: "audit_export_success",
    oldValue: null,
    newValue: { rowCount: (data ?? []).length },
    reason: input?.reason ?? null,
    metadata: { permissionKey: "system.audit.export" },
  });

  return { ok: true as const, rows: data ?? [] };
}

