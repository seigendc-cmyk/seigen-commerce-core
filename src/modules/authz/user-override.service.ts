"use server";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";
import { authorizeForCurrentUser } from "./authorization-guard";
import { getPermissionMeta } from "./permission-registry";
import { evaluateCriticalAction } from "./critical-action.service";
import { logOverrideApplied, logOverrideRemoved } from "./audit-log.service";

function notExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() > Date.now();
}

export async function listUserOverrides(targetUserId: string) {
  const ws = await getDashboardWorkspace();
  const actor = await getServerAuthUser();
  if (!isSupabaseConfigured() || !actor || !ws?.tenant?.id) return { ok: false as const, error: "Not available" };

  const authz = await authorizeForCurrentUser({ permissionKey: "system.permissions.manage" });
  if (!authz.allowed) return { ok: false as const, denied: authz };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("user_permission_overrides")
    .select("id, user_id, is_active, expires_at, override_type, reason, permissions:permission_id(permission_key)")
    .eq("tenant_id", ws.tenant.id)
    .eq("user_id", targetUserId);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, overrides: data ?? [] };
}

async function upsertOverride(input: { targetUserId: string; permissionKey: string; overrideType: "grant" | "deny"; expiresAt?: string | null; reason?: string | null }) {
  const ws = await getDashboardWorkspace();
  const actor = await getServerAuthUser();
  if (!isSupabaseConfigured() || !actor || !ws?.tenant?.id) return { ok: false as const, error: "Not available" };

  const authz = await authorizeForCurrentUser({ permissionKey: "system.permissions.manage", critical: input.reason ? { reason: input.reason } : undefined });
  if (!authz.allowed) return { ok: false as const, denied: authz };

  const meta = await getPermissionMeta(input.permissionKey);
  if (!meta || !meta.isActive) return { ok: false as const, error: "Permission not found or inactive." };

  const critical = evaluateCriticalAction(input.permissionKey, meta);
  if (critical.isCritical && critical.requiresReason && !input.reason?.trim()) {
    return { ok: false as const, error: "Reason is required for critical permission overrides." };
  }

  const supabase = await createServerSupabaseClient();

  // Resolve permission_id
  const { data: permRow } = await supabase.from("permissions").select("id").eq("permission_key", input.permissionKey).maybeSingle();
  if (!permRow?.id) return { ok: false as const, error: "Permission not found." };

  // Deactivate any conflicting active override of same type
  const { data: existing } = await supabase
    .from("user_permission_overrides")
    .select("id, is_active, expires_at")
    .eq("tenant_id", ws.tenant.id)
    .eq("user_id", input.targetUserId)
    .eq("permission_id", permRow.id)
    .eq("override_type", input.overrideType)
    .maybeSingle();

  if (existing?.id && existing.is_active && notExpired((existing.expires_at as string | null) ?? null)) {
    return { ok: true as const, id: existing.id as string, alreadyActive: true as const };
  }

  const { data, error } = await supabase
    .from("user_permission_overrides")
    .upsert(
      {
        tenant_id: ws.tenant.id,
        user_id: input.targetUserId,
        permission_id: permRow.id as string,
        override_type: input.overrideType,
        is_active: true,
        expires_at: input.expiresAt ?? null,
        reason: input.reason ?? null,
        created_by: actor.id,
      },
      { onConflict: "tenant_id,user_id,permission_id,override_type" },
    )
    .select("id")
    .single();

  if (error || !data) return { ok: false as const, error: error?.message ?? "Failed to apply override" };

  await logOverrideApplied({
    actorUserId: actor.id,
    tenantId: ws.tenant.id,
    entityId: data.id as string,
    oldValue: existing ?? null,
    newValue: { targetUserId: input.targetUserId, permissionKey: input.permissionKey, overrideType: input.overrideType, expiresAt: input.expiresAt ?? null },
    reason: input.reason ?? null,
    metadata: { riskLevel: meta.riskLevel, scopeType: meta.scopeType },
  });

  return { ok: true as const, id: data.id as string };
}

export async function grantPermissionToUser(input: { targetUserId: string; permissionKey: string; expiresAt?: string | null; reason?: string | null }) {
  return upsertOverride({ ...input, overrideType: "grant" });
}

export async function denyPermissionToUser(input: { targetUserId: string; permissionKey: string; expiresAt?: string | null; reason?: string | null }) {
  return upsertOverride({ ...input, overrideType: "deny" });
}

export async function removeOverride(input: { overrideId: string; reason?: string | null }) {
  const ws = await getDashboardWorkspace();
  const actor = await getServerAuthUser();
  if (!isSupabaseConfigured() || !actor || !ws?.tenant?.id) return { ok: false as const, error: "Not available" };

  const authz = await authorizeForCurrentUser({ permissionKey: "system.permissions.manage", critical: input.reason ? { reason: input.reason } : undefined });
  if (!authz.allowed) return { ok: false as const, denied: authz };

  const supabase = await createServerSupabaseClient();
  const { data: row } = await supabase
    .from("user_permission_overrides")
    .select("id, tenant_id, user_id, override_type, permissions:permission_id(permission_key)")
    .eq("id", input.overrideId)
    .maybeSingle();
  if (!row) return { ok: false as const, error: "Override not found." };
  if ((row as any).tenant_id !== ws.tenant.id) return { ok: false as const, error: "Tenant mismatch." };

  const { error } = await supabase.from("user_permission_overrides").update({ is_active: false }).eq("id", input.overrideId);
  if (error) return { ok: false as const, error: error.message };

  await logOverrideRemoved({
    actorUserId: actor.id,
    tenantId: ws.tenant.id,
    entityId: input.overrideId,
    oldValue: row,
    newValue: { is_active: false },
    reason: input.reason ?? null,
    metadata: {},
  });

  return { ok: true as const };
}

