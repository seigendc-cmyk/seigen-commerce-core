import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loadPermissionMetaByKeys } from "./permission-registry";
import { listAccessibleDesks as listAccessibleDesksViaService } from "./desk-access.service";
import type { EffectiveAccessSnapshot } from "./types";

function notExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() > Date.now();
}

export async function getEffectiveAccessSnapshot(tenantId: string, userId: string): Promise<EffectiveAccessSnapshot | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabaseClient();

  const { data: userRoles } = await supabase
    .from("user_roles")
    .select("id, role_id, is_primary, is_active, expires_at, roles:role_id(id, role_code, name, is_active, is_archived)")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);

  const activeAssignments = (userRoles ?? [])
    .filter((r: any) => Boolean(r.is_active) && notExpired((r.expires_at as string | null) ?? null))
    .filter((r: any) => Boolean(r.roles?.is_active) && !Boolean(r.roles?.is_archived));

  const roleIds = activeAssignments.map((r: any) => r.role_id as string);

  const [{ data: rolePerms }, { data: overrides }, { data: scopes }] = await Promise.all([
    roleIds.length
      ? supabase
          .from("role_permissions")
          .select("role_id, granted, permissions:permission_id(permission_key)")
          .in("role_id", roleIds)
      : Promise.resolve({ data: [] as any[] }),
    supabase
      .from("user_permission_overrides")
      .select("id, is_active, expires_at, override_type, permissions:permission_id(permission_key)")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId),
    supabase
      .from("user_access_scopes")
      .select("id, scope_entity_type, scope_entity_id, scope_code, access_level, is_active, expires_at")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId),
  ]);

  const rolePermissionKeys = (rolePerms ?? [])
    .filter((rp: any) => rp.granted !== false)
    .map((rp: any) => rp.permissions?.permission_key as string)
    .filter(Boolean);

  const activeOverrides = (overrides ?? []).filter((o: any) => Boolean(o.is_active) && notExpired((o.expires_at as string | null) ?? null));
  const deniedByOverrides = activeOverrides
    .filter((o: any) => o.override_type === "deny")
    .map((o: any) => o.permissions?.permission_key as string)
    .filter(Boolean);
  const grantedByOverrides = activeOverrides
    .filter((o: any) => o.override_type === "grant")
    .map((o: any) => o.permissions?.permission_key as string)
    .filter(Boolean);

  const effectiveSet = new Set<string>([...rolePermissionKeys, ...grantedByOverrides]);
  for (const d of deniedByOverrides) effectiveSet.delete(d);

  const effectivePermissionKeys = Array.from(effectiveSet).sort();
  const deniedPermissionKeys = Array.from(new Set<string>(deniedByOverrides)).sort();

  const metaByKey = await loadPermissionMetaByKeys(effectivePermissionKeys);
  const riskCounts = { criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0 };
  for (const k of effectivePermissionKeys) {
    const m = metaByKey[k];
    if (!m) continue;
    if (m.riskLevel === "critical") riskCounts.criticalCount += 1;
    else if (m.riskLevel === "high") riskCounts.highCount += 1;
    else if (m.riskLevel === "medium") riskCounts.mediumCount += 1;
    else riskCounts.lowCount += 1;
  }

  const primary = activeAssignments.find((a: any) => Boolean(a.is_primary));

  const accessibleDesks = await listAccessibleDesksViaService(tenantId, userId);

  return {
    tenantId,
    userId,
    generatedAt: new Date().toISOString(),
    assignedRoles: activeAssignments.map((a: any) => ({
      roleId: a.role_id as string,
      roleCode: a.roles?.role_code as string,
      name: a.roles?.name as string,
      isPrimary: Boolean(a.is_primary),
    })),
    primaryRoleCode: ((primary as any)?.roles?.role_code as string | undefined) ?? null,
    effectivePermissionKeys,
    deniedPermissionKeys,
    grantedByOverrides,
    deniedByOverrides,
    scopes: (scopes ?? []).map((s: any) => ({
      scopeEntityType: s.scope_entity_type,
      scopeEntityId: (s.scope_entity_id as string | null) ?? null,
      scopeCode: (s.scope_code as string | null) ?? null,
      accessLevel: s.access_level,
      expiresAt: (s.expires_at as string | null) ?? null,
    })),
    accessibleDesks,
    riskSummary: riskCounts,
  };
}

export async function listEffectivePermissionKeys(tenantId: string, userId: string) {
  const snap = await getEffectiveAccessSnapshot(tenantId, userId);
  return snap?.effectivePermissionKeys ?? [];
}

export async function listDeniedPermissionKeys(tenantId: string, userId: string) {
  const snap = await getEffectiveAccessSnapshot(tenantId, userId);
  return snap?.deniedPermissionKeys ?? [];
}

export async function listAccessibleDesksSnapshot(tenantId: string, userId: string) {
  const snap = await getEffectiveAccessSnapshot(tenantId, userId);
  return snap?.accessibleDesks ?? [];
}


