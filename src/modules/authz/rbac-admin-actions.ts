"use server";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";
import { authorizeForCurrentUser } from "./authorization-guard";
import { getEffectiveAccessSnapshot } from "./effective-access.service";
import { logGovernanceEvent } from "./audit-log.service";
import { listUserRoles } from "./role-assignment.service";

/** SysAdmin Security console — minimum gate */
async function gateDeskSysadmin() {
  return authorizeForCurrentUser({ permissionKey: "desk.sysadmin.access" });
}

async function gateRolesManage() {
  return authorizeForCurrentUser({ permissionKey: "system.roles.manage" });
}

async function gatePermissionsManage() {
  return authorizeForCurrentUser({ permissionKey: "system.permissions.manage" });
}

async function gateUsersManage() {
  return authorizeForCurrentUser({ permissionKey: "system.users.manage" });
}

async function gateAuditView() {
  return authorizeForCurrentUser({ permissionKey: "system.audit.view" });
}

function normRoleCode(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

export type RbacRoleRow = {
  id: string;
  tenant_id: string | null;
  role_code: string;
  name: string;
  description: string | null;
  scope_type: string;
  is_system: boolean;
  is_protected: boolean;
  is_active: boolean;
  is_archived: boolean;
  updated_at: string;
  permissionCount: number;
  assignedUserCount: number;
};

export async function rbacListRoles(): Promise<{ ok: true; roles: RbacRoleRow[] } | { ok: false; denied?: unknown; error?: string }> {
  const g = await gateDeskSysadmin();
  if (!g.allowed) return { ok: false, denied: g };
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured" };
  const ws = await getDashboardWorkspace();
  if (!ws?.tenant?.id) return { ok: false, error: "No workspace" };
  const supabase = await createServerSupabaseClient();

  const sel =
    "id, tenant_id, role_code, name, description, scope_type, is_system, is_protected, is_active, is_archived, updated_at";
  const [{ data: systemRoles, error: e1 }, { data: tenantRoles, error: e2 }] = await Promise.all([
    supabase.from("roles").select(sel).is("tenant_id", null).order("name", { ascending: true }),
    supabase.from("roles").select(sel).eq("tenant_id", ws.tenant.id).order("name", { ascending: true }),
  ]);
  if (e1 || e2) return { ok: false, error: e1?.message || e2?.message || "Failed to load roles" };
  const roles = [...(systemRoles ?? []), ...(tenantRoles ?? [])];

  const roleIds = roles.map((r: any) => r.id as string);
  const [{ data: rpRows }, { data: urRows }] = await Promise.all([
    roleIds.length
      ? supabase.from("role_permissions").select("role_id").eq("granted", true).in("role_id", roleIds)
      : Promise.resolve({ data: [] as any[] }),
    supabase.from("user_roles").select("role_id").eq("tenant_id", ws.tenant.id).eq("is_active", true),
  ]);

  const permCount = new Map<string, number>();
  for (const row of rpRows ?? []) {
    const id = (row as any).role_id as string;
    permCount.set(id, (permCount.get(id) ?? 0) + 1);
  }
  const userCount = new Map<string, number>();
  for (const row of urRows ?? []) {
    const id = (row as any).role_id as string;
    userCount.set(id, (userCount.get(id) ?? 0) + 1);
  }

  const out: RbacRoleRow[] = (roles ?? []).map((r: any) => ({
    id: r.id,
    tenant_id: r.tenant_id,
    role_code: r.role_code,
    name: r.name,
    description: r.description,
    scope_type: r.scope_type,
    is_system: r.is_system,
    is_protected: r.is_protected,
    is_active: r.is_active,
    is_archived: r.is_archived,
    updated_at: r.updated_at,
    permissionCount: permCount.get(r.id) ?? 0,
    assignedUserCount: userCount.get(r.id) ?? 0,
  }));
  return { ok: true, roles: out };
}

export async function rbacListTenantMembers(): Promise<
  { ok: true; members: Array<{ user_id: string; role: string }> } | { ok: false; denied?: unknown; error?: string }
> {
  const g = await gateUsersManage();
  if (!g.allowed) return { ok: false, denied: g };
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured" };
  const ws = await getDashboardWorkspace();
  if (!ws?.tenant?.id) return { ok: false, error: "No workspace" };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("tenant_members").select("user_id, role").eq("tenant_id", ws.tenant.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, members: (data ?? []) as any[] };
}

export async function rbacGetPermissionRegistry(opts?: { module?: string; risk?: string }) {
  const g = await gateDeskSysadmin();
  if (!g.allowed) return { ok: false, denied: g };
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  let q = supabase
    .from("permissions")
    .select(
      "id, permission_key, label, description, module_code, category_code, resource_code, action_code, risk_level, scope_type, is_protected, is_destructive, is_approval_capable, is_active, sort_order",
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (opts?.module) q = q.eq("module_code", opts.module);
  if (opts?.risk) q = q.eq("risk_level", opts.risk);
  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };

  const ids = (data ?? []).map((p: any) => p.id);
  let depCounts = new Map<string, number>();
  if (ids.length) {
    const { data: deps } = await supabase.from("permission_dependencies").select("permission_id").in("permission_id", ids);
    for (const d of deps ?? []) {
      const id = (d as any).permission_id as string;
      depCounts.set(id, (depCounts.get(id) ?? 0) + 1);
    }
  }
  return {
    ok: true as const,
    permissions: (data ?? []).map((p: any) => ({
      ...p,
      dependencyCount: depCounts.get(p.id) ?? 0,
    })),
  };
}

export async function rbacGetMatrixData(roleIds: string[]) {
  const g = await gateDeskSysadmin();
  if (!g.allowed) return { ok: false, denied: g };
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured" };
  const ws = await getDashboardWorkspace();
  if (!ws?.tenant?.id) return { ok: false, error: "No workspace" };
  const uniq = Array.from(new Set(roleIds)).slice(0, 5);
  if (uniq.length === 0) return { ok: false, error: "Select at least one role." };

  const supabase = await createServerSupabaseClient();
  const { data: roles, error: rErr } = await supabase
    .from("roles")
    .select("id, tenant_id, role_code, name, is_system, is_protected, is_active, is_archived")
    .in("id", uniq);
  if (rErr) return { ok: false, error: rErr.message };

  const { data: perms, error: pErr } = await supabase
    .from("permissions")
    .select(
      "id, permission_key, label, description, module_code, category_code, risk_level, scope_type, is_protected, is_destructive, is_approval_capable, is_active, sort_order",
    )
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (pErr) return { ok: false, error: pErr.message };

  const permIds = (perms ?? []).map((p: any) => p.id);
  const idToKey = new Map<string, string>();
  for (const p of perms ?? []) idToKey.set((p as any).id as string, (p as any).permission_key as string);

  const { data: deps } = await supabase
    .from("permission_dependencies")
    .select("permission_id, depends_on_permission_id")
    .in("permission_id", permIds);

  const depByPerm = new Map<string, string[]>();
  for (const d of deps ?? []) {
    const pid = (d as any).permission_id as string;
    const depId = (d as any).depends_on_permission_id as string;
    const depKey = idToKey.get(depId);
    if (!depKey) continue;
    if (!depByPerm.has(pid)) depByPerm.set(pid, []);
    depByPerm.get(pid)!.push(depKey);
  }

  const { data: grants, error: gErr } = await supabase
    .from("role_permissions")
    .select("role_id, permission_id, granted")
    .in("role_id", uniq)
    .eq("granted", true);
  if (gErr) return { ok: false, error: gErr.message };

  const grantSet = new Set<string>();
  for (const row of grants ?? []) {
    grantSet.add(`${(row as any).role_id}:${(row as any).permission_id}`);
  }

  return {
    ok: true as const,
    roles: roles ?? [],
    permissions: (perms ?? []).map((p: any) => ({
      ...p,
      dependsOnKeys: depByPerm.get(p.id) ?? [],
    })),
    grants: Array.from(grantSet),
  };
}

export async function rbacSaveRolePermissions(input: {
  roleId: string;
  permissionKeys: string[];
  reason?: string | null;
}): Promise<{ ok: true } | { ok: false; error?: string; denied?: unknown }> {
  const g = await gatePermissionsManage();
  if (!g.allowed) return { ok: false, denied: g };
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured" };
  const ws = await getDashboardWorkspace();
  const actor = await getServerAuthUser();
  if (!ws?.tenant?.id || !actor) return { ok: false, error: "No workspace" };

  const supabase = await createServerSupabaseClient();
  const { data: role, error: rErr } = await supabase
    .from("roles")
    .select("id, tenant_id, is_system, is_protected, is_archived")
    .eq("id", input.roleId)
    .maybeSingle();
  if (rErr || !role) return { ok: false, error: rErr?.message ?? "Role not found" };
  if ((role as any).is_archived) return { ok: false, error: "Cannot edit archived role." };
  if ((role as any).is_system || (role as any).tenant_id === null) {
    return { ok: false, error: "System roles cannot be edited here." };
  }
  if ((role as any).tenant_id !== ws.tenant.id) return { ok: false, error: "Tenant mismatch." };

  const { data: permRows, error: pkErr } = await supabase
    .from("permissions")
    .select("id, permission_key")
    .in("permission_key", input.permissionKeys);
  if (pkErr) return { ok: false, error: pkErr.message };
  const wantedIds = new Set((permRows ?? []).map((p: any) => p.id as string));

  const { data: existing, error: eErr } = await supabase.from("role_permissions").select("id, permission_id, granted").eq("role_id", input.roleId);
  if (eErr) return { ok: false, error: eErr.message };

  const existingGranted = new Map<string, string>(); // permission_id -> rp row id
  for (const row of existing ?? []) {
    const r = row as any;
    if (r.granted) existingGranted.set(r.permission_id as string, r.id as string);
  }

  const toRevoke: string[] = [];
  for (const [permId, rpId] of existingGranted) {
    if (!wantedIds.has(permId)) toRevoke.push(rpId);
  }
  const toGrant: string[] = [];
  for (const permId of wantedIds) {
    if (!existingGranted.has(permId)) toGrant.push(permId);
  }

  if (toRevoke.length) {
    const { error: dErr } = await supabase.from("role_permissions").delete().in("id", toRevoke);
    if (dErr) return { ok: false, error: dErr.message };
  }
  if (toGrant.length) {
    const { error: iErr } = await supabase.from("role_permissions").insert(
      toGrant.map((permission_id) => ({
        role_id: input.roleId,
        permission_id,
        granted: true,
        created_by: actor.id,
      })),
    );
    if (iErr) return { ok: false, error: iErr.message };
  }

  await logGovernanceEvent({
    actorUserId: actor.id,
    tenantId: ws.tenant.id,
    entityType: "role_permissions",
    entityId: input.roleId,
    actionCode: "role_permissions_saved",
    oldValue: { revoked: toRevoke.length, granted: toGrant.length },
    newValue: { permissionKeyCount: input.permissionKeys.length },
    reason: input.reason ?? null,
    metadata: {},
  });

  return { ok: true };
}

export async function rbacCreateTenantRole(input: {
  name: string;
  roleCode: string;
  description?: string | null;
  scopeType?: string;
  copyFromRoleId?: string | null;
  reason?: string | null;
}) {
  const g = await gateRolesManage();
  if (!g.allowed) return { ok: false, denied: g };
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured" };
  const ws = await getDashboardWorkspace();
  const actor = await getServerAuthUser();
  if (!ws?.tenant?.id || !actor) return { ok: false, error: "No workspace" };

  const code = normRoleCode(input.roleCode || input.name);
  if (!code) return { ok: false, error: "Invalid role code." };

  const supabase = await createServerSupabaseClient();
  const { data: created, error } = await supabase
    .from("roles")
    .insert({
      tenant_id: ws.tenant.id,
      role_code: code,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      scope_type: input.scopeType || "tenant",
      is_system: false,
      is_protected: false,
      is_active: true,
      is_archived: false,
      created_by: actor.id,
      updated_by: actor.id,
    })
    .select("id")
    .single();
  if (error || !created) return { ok: false, error: error?.message.includes("unique") ? "Role code already exists." : error?.message };

  const newId = created.id as string;

  if (input.copyFromRoleId) {
    const { data: srcRows } = await supabase.from("role_permissions").select("permission_id, granted").eq("role_id", input.copyFromRoleId).eq("granted", true);
    if (srcRows?.length) {
      await supabase.from("role_permissions").insert(
        srcRows.map((r: any) => ({
          role_id: newId,
          permission_id: r.permission_id,
          granted: true,
          created_by: actor.id,
        })),
      );
    }
  }

  await logGovernanceEvent({
    actorUserId: actor.id,
    tenantId: ws.tenant.id,
    entityType: "role",
    entityId: newId,
    actionCode: "role_created",
    oldValue: null,
    newValue: { role_code: code, name: input.name, copyFromRoleId: input.copyFromRoleId ?? null },
    reason: input.reason ?? null,
    metadata: {},
  });

  return { ok: true as const, id: newId };
}

export async function rbacArchiveTenantRole(input: { roleId: string; reason?: string | null }) {
  const g = await gateRolesManage();
  if (!g.allowed) return { ok: false, denied: g };
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured" };
  const ws = await getDashboardWorkspace();
  const actor = await getServerAuthUser();
  if (!ws?.tenant?.id || !actor) return { ok: false, error: "No workspace" };
  const supabase = await createServerSupabaseClient();
  const { data: role } = await supabase.from("roles").select("id, tenant_id, is_system, is_protected").eq("id", input.roleId).maybeSingle();
  if (!role) return { ok: false, error: "Not found" };
  if ((role as any).is_system || (role as any).tenant_id === null) return { ok: false, error: "System role cannot be archived." };
  if ((role as any).tenant_id !== ws.tenant.id) return { ok: false, error: "Tenant mismatch." };
  if ((role as any).is_protected) return { ok: false, error: "Protected role cannot be archived." };

  const { error } = await supabase.from("roles").update({ is_archived: true, is_active: false, updated_by: actor.id }).eq("id", input.roleId);
  if (error) return { ok: false, error: error.message };

  await logGovernanceEvent({
    actorUserId: actor.id,
    tenantId: ws.tenant.id,
    entityType: "role",
    entityId: input.roleId,
    actionCode: "role_archived",
    oldValue: role,
    newValue: { is_archived: true },
    reason: input.reason ?? null,
    metadata: {},
  });
  return { ok: true as const };
}

export async function rbacUpdateTenantRole(input: {
  roleId: string;
  name?: string;
  description?: string | null;
  scopeType?: string;
  isActive?: boolean;
  reason?: string | null;
}) {
  const g = await gateRolesManage();
  if (!g.allowed) return { ok: false, denied: g };
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured" };
  const ws = await getDashboardWorkspace();
  const actor = await getServerAuthUser();
  if (!ws?.tenant?.id || !actor) return { ok: false, error: "No workspace" };
  const supabase = await createServerSupabaseClient();
  const { data: role } = await supabase.from("roles").select("*").eq("id", input.roleId).maybeSingle();
  if (!role) return { ok: false, error: "Not found" };
  if ((role as any).is_system || (role as any).tenant_id === null) return { ok: false, error: "System role cannot be edited." };
  if ((role as any).tenant_id !== ws.tenant.id) return { ok: false, error: "Tenant mismatch." };

  const patch: Record<string, unknown> = { updated_by: actor.id };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.description !== undefined) patch.description = input.description;
  if (input.scopeType !== undefined) patch.scope_type = input.scopeType;
  if (input.isActive !== undefined) patch.is_active = input.isActive;

  const { error } = await supabase.from("roles").update(patch).eq("id", input.roleId);
  if (error) return { ok: false, error: error.message };

  await logGovernanceEvent({
    actorUserId: actor.id,
    tenantId: ws.tenant.id,
    entityType: "role",
    entityId: input.roleId,
    actionCode: "role_updated",
    oldValue: role,
    newValue: patch,
    reason: input.reason ?? null,
    metadata: {},
  });
  return { ok: true as const };
}

export async function rbacListPermissionAuditLogs(input?: {
  from?: string;
  to?: string;
  entityType?: string;
  actionCode?: string;
  limit?: number;
}) {
  const g = await gateAuditView();
  if (!g.allowed) return { ok: false, denied: g };
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured" };
  const ws = await getDashboardWorkspace();
  if (!ws?.tenant?.id) return { ok: false, error: "No workspace" };
  const supabase = await createServerSupabaseClient();
  let q = supabase
    .from("permission_audit_logs")
    .select("id, tenant_id, actor_user_id, entity_type, entity_id, action_code, old_value, new_value, reason, metadata, created_at")
    .eq("tenant_id", ws.tenant.id)
    .order("created_at", { ascending: false })
    .limit(Math.min(500, Math.max(1, input?.limit ?? 100)));
  if (input?.from) q = q.gte("created_at", input.from);
  if (input?.to) q = q.lte("created_at", input.to);
  if (input?.entityType) q = q.eq("entity_type", input.entityType);
  if (input?.actionCode) q = q.eq("action_code", input.actionCode);
  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  return { ok: true as const, events: data ?? [] };
}

export async function rbacGetUserAccessBundle(targetUserId: string) {
  const g = await gateUsersManage();
  if (!g.allowed) return { ok: false, denied: g };
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured" };
  const ws = await getDashboardWorkspace();
  if (!ws?.tenant?.id) return { ok: false, error: "No workspace" };

  const supabase = await createServerSupabaseClient();
  const { data: mem } = await supabase.from("tenant_members").select("user_id, role").eq("tenant_id", ws.tenant.id).eq("user_id", targetUserId).maybeSingle();
  if (!mem) return { ok: false, error: "User is not a member of this workspace." };

  const snap = await getEffectiveAccessSnapshot(ws.tenant.id, targetUserId);
  const ur = await listUserRoles(targetUserId);
  const [{ data: ovRows }, { data: scRows }] = await Promise.all([
    supabase
      .from("user_permission_overrides")
      .select("id, user_id, is_active, expires_at, override_type, reason, permissions:permission_id(permission_key)")
      .eq("tenant_id", ws.tenant.id)
      .eq("user_id", targetUserId),
    supabase
      .from("user_access_scopes")
      .select("id, scope_entity_type, scope_entity_id, scope_code, access_level, is_active, expires_at")
      .eq("tenant_id", ws.tenant.id)
      .eq("user_id", targetUserId),
  ]);

  return {
    ok: true as const,
    membership: mem,
    snapshot: snap,
    userRoles: ur.ok ? ur.roles : [],
    overrides: ovRows ?? [],
    scopes: scRows ?? [],
  };
}

export async function rbacCompareRoles(roleIds: string[]) {
  const g = await gateDeskSysadmin();
  if (!g.allowed) return { ok: false as const, denied: g };
  const matrix = await rbacGetMatrixData(roleIds);
  if (!matrix.ok) return matrix;
  const roles = matrix.roles as any[];
  const perms = matrix.permissions as any[];
  const grantSet = new Set(matrix.grants as string[]);

  const byRole = new Map<string, Set<string>>();
  for (const rid of roleIds) {
    byRole.set(
      rid,
      new Set(perms.filter((p) => grantSet.has(`${rid}:${p.id}`)).map((p) => p.permission_key as string)),
    );
  }
  const union = new Set<string>();
  for (const s of byRole.values()) for (const k of s) union.add(k);

  const uniquePerRole: Record<string, string[]> = {};
  for (const rid of roleIds) {
    const mine = byRole.get(rid)!;
    uniquePerRole[rid] = [...mine].filter((k) => {
      let count = 0;
      for (const other of roleIds) {
        if (byRole.get(other)!.has(k)) count += 1;
      }
      return count === 1 && mine.has(k);
    });
  }

  return {
    ok: true as const,
    roles,
    permissionKeysUnion: [...union].sort(),
    uniquePerRole,
    criticalCounts: Object.fromEntries(
      roleIds.map((rid) => {
        const keys = byRole.get(rid)!;
        const crit = perms.filter((p) => keys.has(p.permission_key) && p.risk_level === "critical").length;
        return [rid, crit];
      }),
    ),
  };
}
