"use server";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";
import { PROTECTED_SYSTEM_ROLE_CODES } from "@/modules/rbac/rbac-constants";
import { authorizeForCurrentUser } from "./authorization-guard";
import { logRoleAssignment, logRoleRemoval, logPrimaryRoleChange, logGovernanceEvent } from "./audit-log.service";

function notExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() > Date.now();
}

export async function listUserRoles(targetUserId: string) {
  const ws = await getDashboardWorkspace();
  const actor = await getServerAuthUser();
  if (!isSupabaseConfigured() || !actor || !ws?.tenant?.id) return { ok: false as const, error: "Not available" };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("user_roles")
    .select("id, user_id, role_id, is_primary, is_active, expires_at, roles:role_id(role_code, name, is_system, is_protected, is_active, is_archived)")
    .eq("tenant_id", ws.tenant.id)
    .eq("user_id", targetUserId);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, roles: data ?? [] };
}

export async function assignRoleToUser(input: { targetUserId: string; roleId: string; isPrimary?: boolean; expiresAt?: string | null; reason?: string }) {
  const ws = await getDashboardWorkspace();
  const actor = await getServerAuthUser();
  if (!isSupabaseConfigured() || !actor || !ws?.tenant?.id) return { ok: false as const, error: "Not available" };

  const authz = await authorizeForCurrentUser({ permissionKey: "system.roles.assign", critical: input.reason ? { reason: input.reason } : undefined });
  if (!authz.allowed) return { ok: false as const, denied: authz };

  const supabase = await createServerSupabaseClient();

  const { data: roleRow, error: roleErr } = await supabase
    .from("roles")
    .select("id, tenant_id, role_code, is_active, is_archived, is_protected, is_system")
    .eq("id", input.roleId)
    .maybeSingle();
  if (roleErr || !roleRow) return { ok: false as const, error: roleErr?.message ?? "Role not found" };
  if (roleRow.is_archived || !roleRow.is_active) return { ok: false as const, error: "Cannot assign inactive/archived role." };

  // tenant-safe: role must be system (tenant_id null) or tenant-matching
  if (roleRow.tenant_id && roleRow.tenant_id !== ws.tenant.id) return { ok: false as const, error: "Role tenant mismatch." };

  // ensure target user is member of tenant
  const { data: member } = await supabase.from("tenant_members").select("tenant_id").eq("tenant_id", ws.tenant.id).eq("user_id", input.targetUserId).maybeSingle();
  if (!member) return { ok: false as const, error: "Target user is not a member of this workspace." };

  // if making primary, clear previous primary in a transaction-like sequence
  if (input.isPrimary) {
    await supabase.from("user_roles").update({ is_primary: false }).eq("tenant_id", ws.tenant.id).eq("user_id", input.targetUserId).eq("is_active", true);
  }

  const { data: inserted, error } = await supabase
    .from("user_roles")
    .insert({
      tenant_id: ws.tenant.id,
      user_id: input.targetUserId,
      role_id: input.roleId,
      is_primary: input.isPrimary ?? false,
      is_active: true,
      assigned_by: actor.id,
      expires_at: input.expiresAt ?? null,
    })
    .select("id")
    .single();

  if (error || !inserted) return { ok: false as const, error: error?.message ?? "Failed to assign role" };

  await logRoleAssignment({
    actorUserId: actor.id,
    tenantId: ws.tenant.id,
    entityId: inserted.id as string,
    oldValue: null,
    newValue: { targetUserId: input.targetUserId, roleId: input.roleId, isPrimary: Boolean(input.isPrimary), expiresAt: input.expiresAt ?? null },
    reason: input.reason ?? null,
    metadata: { permissionKey: "system.roles.assign" },
  });

  return { ok: true as const, id: inserted.id as string };
}

export async function removeRoleFromUser(input: { userRoleId: string; reason?: string }) {
  const ws = await getDashboardWorkspace();
  const actor = await getServerAuthUser();
  if (!isSupabaseConfigured() || !actor || !ws?.tenant?.id) return { ok: false as const, error: "Not available" };

  const authz = await authorizeForCurrentUser({ permissionKey: "system.roles.assign", critical: input.reason ? { reason: input.reason } : undefined });
  if (!authz.allowed) return { ok: false as const, denied: authz };

  const supabase = await createServerSupabaseClient();

  const { data: ur, error: urErr } = await supabase
    .from("user_roles")
    .select("id, user_id, role_id, is_primary, is_active, expires_at, roles:role_id(role_code, is_protected, is_system)")
    .eq("id", input.userRoleId)
    .maybeSingle();
  if (urErr || !ur) return { ok: false as const, error: urErr?.message ?? "Role assignment not found" };

  // tenant safety: only within current tenant
  const { data: urTenant } = await supabase.from("user_roles").select("tenant_id").eq("id", input.userRoleId).maybeSingle();
  if ((urTenant as any)?.tenant_id !== ws.tenant.id) return { ok: false as const, error: "Tenant mismatch." };

  const roleCode = ((ur as any).roles?.role_code as string | undefined) ?? "";
  const protectedSys = PROTECTED_SYSTEM_ROLE_CODES.includes(roleCode as any);
  if (protectedSys || Boolean((ur as any).roles?.is_protected)) {
    // safety rule: cannot remove last active protected sysadmin
    const { data: remaining } = await supabase
      .from("user_roles")
      .select("id, is_active, expires_at, roles:role_id(role_code, is_active, is_archived)")
      .eq("tenant_id", ws.tenant.id)
      .eq("is_active", true);
    const activeAdmins = (remaining ?? [])
      .filter((r: any) => notExpired((r.expires_at as string | null) ?? null))
      .filter((r: any) => r.roles?.role_code === roleCode && r.roles?.is_active && !r.roles?.is_archived);
    if (activeAdmins.length <= 1) {
      await logGovernanceEvent({
        actorUserId: actor.id,
        tenantId: ws.tenant.id,
        entityType: "user_role",
        entityId: ur.id as string,
        actionCode: "protected_role_removal_blocked",
        oldValue: ur,
        newValue: null,
        reason: input.reason ?? null,
        metadata: { roleCode },
      });
      return { ok: false as const, error: "Cannot remove the last active SysAdmin for this workspace." };
    }
  }

  const { error } = await supabase.from("user_roles").update({ is_active: false }).eq("id", input.userRoleId);
  if (error) return { ok: false as const, error: error.message };

  await logRoleRemoval({
    actorUserId: actor.id,
    tenantId: ws.tenant.id,
    entityId: ur.id as string,
    oldValue: ur,
    newValue: { is_active: false },
    reason: input.reason ?? null,
    metadata: { roleCode },
  });

  return { ok: true as const };
}

export async function setPrimaryRole(input: { userRoleId: string; reason?: string }) {
  const ws = await getDashboardWorkspace();
  const actor = await getServerAuthUser();
  if (!isSupabaseConfigured() || !actor || !ws?.tenant?.id) return { ok: false as const, error: "Not available" };

  const authz = await authorizeForCurrentUser({ permissionKey: "system.roles.assign", critical: input.reason ? { reason: input.reason } : undefined });
  if (!authz.allowed) return { ok: false as const, denied: authz };

  const supabase = await createServerSupabaseClient();

  const { data: ur, error: urErr } = await supabase
    .from("user_roles")
    .select("id, tenant_id, user_id, is_active")
    .eq("id", input.userRoleId)
    .maybeSingle();
  if (urErr || !ur) return { ok: false as const, error: urErr?.message ?? "Role assignment not found" };
  if (ur.tenant_id !== ws.tenant.id) return { ok: false as const, error: "Tenant mismatch." };
  if (!ur.is_active) return { ok: false as const, error: "Role assignment is inactive." };

  await supabase.from("user_roles").update({ is_primary: false }).eq("tenant_id", ws.tenant.id).eq("user_id", ur.user_id).eq("is_active", true);
  const { error } = await supabase.from("user_roles").update({ is_primary: true }).eq("id", input.userRoleId);
  if (error) return { ok: false as const, error: error.message };

  await logPrimaryRoleChange({
    actorUserId: actor.id,
    tenantId: ws.tenant.id,
    entityId: ur.id as string,
    oldValue: null,
    newValue: { is_primary: true },
    reason: input.reason ?? null,
    metadata: {},
  });

  return { ok: true as const };
}

