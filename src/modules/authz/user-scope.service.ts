"use server";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";
import { authorizeForCurrentUser } from "./authorization-guard";
import { logGovernanceEvent } from "./audit-log.service";

export type UserScopeRow = {
  id: string;
  scopeEntityType: string;
  scopeEntityId: string | null;
  scopeCode: string | null;
  accessLevel: string;
  isActive: boolean;
  expiresAt: string | null;
};

async function gateScopeOrUsersManage() {
  const a = await authorizeForCurrentUser({ permissionKey: "staff.user.scope_manage" });
  if (a.allowed) return a;
  return authorizeForCurrentUser({ permissionKey: "system.users.manage" });
}

export async function listUserScopesForUser(targetUserId: string): Promise<
  | { ok: true; scopes: UserScopeRow[] }
  | { ok: false; error: string; denied?: unknown }
> {
  const ws = await getDashboardWorkspace();
  const actor = await getServerAuthUser();
  if (!isSupabaseConfigured() || !actor || !ws?.tenant?.id) return { ok: false, error: "Not available" };
  const gate = await gateScopeOrUsersManage();
  if (!gate.allowed) return { ok: false, error: "Not authorized", denied: gate };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("user_access_scopes")
    .select("id, scope_entity_type, scope_entity_id, scope_code, access_level, is_active, expires_at")
    .eq("tenant_id", ws.tenant.id)
    .eq("user_id", targetUserId)
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: error.message };
  const rows = (data ?? []) as Array<{
    id: string;
    scope_entity_type: string;
    scope_entity_id: string | null;
    scope_code: string | null;
    access_level: string;
    is_active: boolean;
    expires_at: string | null;
  }>;
  const scopes: UserScopeRow[] = rows.map((r) => ({
    id: r.id,
    scopeEntityType: r.scope_entity_type,
    scopeEntityId: r.scope_entity_id,
    scopeCode: r.scope_code,
    accessLevel: r.access_level,
    isActive: r.is_active,
    expiresAt: r.expires_at,
  }));
  return { ok: true, scopes };
}

export async function addUserScope(input: {
  targetUserId: string;
  scopeEntityType: "tenant" | "branch" | "warehouse" | "terminal" | "desk";
  scopeEntityId?: string | null;
  scopeCode?: string | null;
  accessLevel?: "allowed" | "denied" | "read_only";
  expiresAt?: string | null;
  reason?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string; denied?: unknown }> {
  const ws = await getDashboardWorkspace();
  const actor = await getServerAuthUser();
  if (!isSupabaseConfigured() || !actor || !ws?.tenant?.id) return { ok: false, error: "Not available" };
  const gate = await gateScopeOrUsersManage();
  if (!gate.allowed) return { ok: false, error: "Not authorized", denied: gate };

  if (input.scopeEntityType !== "tenant" && input.scopeEntityType !== "desk" && !input.scopeEntityId) {
    return { ok: false, error: "scopeEntityId is required for this scope type." };
  }
  if (input.scopeEntityType === "desk" && !input.scopeCode?.trim()) {
    return { ok: false, error: "desk scope requires scopeCode (desk code)." };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("user_access_scopes")
    .insert({
      tenant_id: ws.tenant.id,
      user_id: input.targetUserId,
      scope_entity_type: input.scopeEntityType,
      scope_entity_id: input.scopeEntityId ?? null,
      scope_code: input.scopeCode?.trim() ?? null,
      access_level: input.accessLevel ?? "allowed",
      is_active: true,
      expires_at: input.expiresAt ?? null,
      created_by: actor.id,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed" };

  await logGovernanceEvent({
    actorUserId: actor.id,
    tenantId: ws.tenant.id,
    entityType: "user_access_scope",
    entityId: data.id as string,
    actionCode: "user_scope_added",
    oldValue: null,
    newValue: input,
    reason: input.reason ?? null,
    metadata: {},
  });
  return { ok: true, id: data.id as string };
}

export async function removeUserScope(input: {
  scopeId: string;
  reason?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string; denied?: unknown }> {
  const ws = await getDashboardWorkspace();
  const actor = await getServerAuthUser();
  if (!isSupabaseConfigured() || !actor || !ws?.tenant?.id) return { ok: false, error: "Not available" };
  const gate = await gateScopeOrUsersManage();
  if (!gate.allowed) return { ok: false, error: "Not authorized", denied: gate };

  const supabase = await createServerSupabaseClient();
  const { data: row } = await supabase
    .from("user_access_scopes")
    .select("id, tenant_id, user_id, scope_entity_type, scope_entity_id, scope_code")
    .eq("id", input.scopeId)
    .maybeSingle();
  if (!row || (row as any).tenant_id !== ws.tenant.id) return { ok: false, error: "Scope not found." };

  const { error } = await supabase.from("user_access_scopes").update({ is_active: false }).eq("id", input.scopeId);
  if (error) return { ok: false, error: error.message };

  await logGovernanceEvent({
    actorUserId: actor.id,
    tenantId: ws.tenant.id,
    entityType: "user_access_scope",
    entityId: input.scopeId,
    actionCode: "user_scope_removed",
    oldValue: row,
    newValue: { is_active: false },
    reason: input.reason ?? null,
    metadata: {},
  });
  return { ok: true };
}
