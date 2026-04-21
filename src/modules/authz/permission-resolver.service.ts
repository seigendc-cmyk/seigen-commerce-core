import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServerAuthUser } from "@/lib/auth/session";
import { loadPermissionMetaByKeys } from "./permission-registry";
import { matchesScope } from "./scope-resolver.service";
import { evaluateCriticalAction } from "./critical-action.service";
import type {
  AuthzContext,
  AuthzUserOverride,
  PermissionCheckInput,
  PermissionCheckResult,
} from "./types";
import type { PermissionMeta } from "./types";

function nowIso() {
  return new Date().toISOString();
}

function notExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() > Date.now();
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

async function loadDependenciesByPermissionKey(permissionKeys: string[]) {
  if (!isSupabaseConfigured()) return {} as Record<string, string[]>;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("permission_dependencies")
    .select("permission_id, depends_on_permission_id, permissions:permission_id(permission_key), depends:depends_on_permission_id(permission_key)");

  const deps: Record<string, string[]> = {};
  for (const row of (data ?? []) as any[]) {
    const pk = row?.permissions?.permission_key as string | undefined;
    const dep = row?.depends?.permission_key as string | undefined;
    if (!pk || !dep) continue;
    if (!deps[pk]) deps[pk] = [];
    deps[pk].push(dep);
  }

  // ensure keys exist for requested permissions even if no deps
  for (const k of permissionKeys) {
    if (!deps[k]) deps[k] = [];
  }
  return deps;
}

export async function loadAuthzContext(input: { tenantId: string; userId: string }): Promise<AuthzContext | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createServerSupabaseClient();

  // Tenant membership is the source of truth for tenant boundary.
  const { data: membership } = await supabase
    .from("tenant_members")
    .select("tenant_id, user_id, active")
    .eq("tenant_id", input.tenantId)
    .eq("user_id", input.userId)
    .maybeSingle();

  const userActive = Boolean((membership as any)?.active ?? true);
  if (!membership) {
    return {
      tenantId: input.tenantId,
      userId: input.userId,
      userActive: false,
      roleAssignments: [],
      rolePermissionKeys: [],
      overrides: [],
      scopes: [],
      permissionMetaByKey: {},
      dependenciesByPermissionKey: {},
    };
  }

  const [userRolesRes, rolePermsRes, overridesRes, scopesRes] = await Promise.all([
    supabase
      .from("user_roles")
      .select(
        "id, role_id, is_primary, is_active, expires_at, roles:role_id(id, role_code, name, is_active, is_archived)",
      )
      .eq("tenant_id", input.tenantId)
      .eq("user_id", input.userId),
    supabase
      .from("role_permissions")
      .select("role_id, granted, permissions:permission_id(permission_key)")
      .in(
        "role_id",
        (
          (
            await supabase
              .from("user_roles")
              .select("role_id")
              .eq("tenant_id", input.tenantId)
              .eq("user_id", input.userId)
              .eq("is_active", true)
          ).data ?? []
        ).map((r: any) => r.role_id),
      ),
    supabase
      .from("user_permission_overrides")
      .select(
        "id, is_active, expires_at, override_type, reason, permissions:permission_id(permission_key)",
      )
      .eq("tenant_id", input.tenantId)
      .eq("user_id", input.userId),
    supabase
      .from("user_access_scopes")
      .select("id, scope_entity_type, scope_entity_id, scope_code, access_level, is_active, expires_at")
      .eq("tenant_id", input.tenantId)
      .eq("user_id", input.userId),
  ]);

  const roleAssignments = (userRolesRes.data ?? []).map((r: any) => ({
    id: r.id as string,
    roleId: r.role_id as string,
    roleCode: r.roles?.role_code as string,
    roleName: r.roles?.name as string,
    roleActive: Boolean(r.roles?.is_active),
    roleArchived: Boolean(r.roles?.is_archived),
    isPrimary: Boolean(r.is_primary),
    isActive: Boolean(r.is_active),
    expiresAt: (r.expires_at as string | null) ?? null,
  }));

  const activeAssignments = roleAssignments.filter(
    (a) => a.isActive && a.roleActive && !a.roleArchived && notExpired(a.expiresAt),
  );

  const rolePermissionKeys = (rolePermsRes.data ?? [])
    .filter((rp: any) => rp.granted !== false)
    .filter((rp: any) => activeAssignments.some((a) => a.roleId === rp.role_id))
    .map((rp: any) => rp.permissions?.permission_key as string)
    .filter(Boolean);

  const overrides: AuthzUserOverride[] = (overridesRes.data ?? [])
    .map((o: any) => ({
      id: o.id as string,
      permissionKey: o.permissions?.permission_key as string,
      overrideType: o.override_type as "grant" | "deny",
      isActive: Boolean(o.is_active),
      expiresAt: (o.expires_at as string | null) ?? null,
      reason: (o.reason as string | null) ?? null,
    }))
    .filter((o) => Boolean(o.permissionKey));

  const scopes = (scopesRes.data ?? []).map((s: any) => ({
    id: s.id as string,
    scopeEntityType: s.scope_entity_type,
    scopeEntityId: (s.scope_entity_id as string | null) ?? null,
    scopeCode: (s.scope_code as string | null) ?? null,
    accessLevel: s.access_level,
    isActive: Boolean(s.is_active),
    expiresAt: (s.expires_at as string | null) ?? null,
  }));

  const allPermissionKeys = uniq([
    ...rolePermissionKeys,
    ...overrides.map((o) => o.permissionKey),
  ]);
  const permissionMetaByKey = await loadPermissionMetaByKeys(allPermissionKeys);
  const dependenciesByPermissionKey = await loadDependenciesByPermissionKey(allPermissionKeys);

  return {
    tenantId: input.tenantId,
    userId: input.userId,
    userActive,
    roleAssignments,
    rolePermissionKeys,
    overrides,
    scopes,
    permissionMetaByKey,
    dependenciesByPermissionKey,
  };
}

function baseDeny(permissionKey: string, reasonCode: PermissionCheckResult["reasonCode"], reasonMessage: string): PermissionCheckResult {
  return {
    allowed: false,
    permissionKey,
    reasonCode,
    reasonMessage,
    matchedBy: "none",
    scopeMatched: false,
  };
}

function dependencyWalk(ctx: AuthzContext, permissionKey: string, visited: Set<string>): string[] {
  if (visited.has(permissionKey)) return [];
  visited.add(permissionKey);
  const direct = ctx.dependenciesByPermissionKey[permissionKey] ?? [];
  const out: string[] = [];
  for (const dep of direct) {
    out.push(dep);
    for (const child of dependencyWalk(ctx, dep, visited)) out.push(child);
  }
  return uniq(out);
}

function isAllowedByOverrides(overrides: AuthzUserOverride[], permissionKey: string) {
  const active = overrides.filter((o) => o.isActive && notExpired(o.expiresAt) && o.permissionKey === permissionKey);
  const deny = active.find((o) => o.overrideType === "deny");
  if (deny) return { allowed: false, matchedBy: "user_override_deny" as const, expiresAt: deny.expiresAt };
  const grant = active.find((o) => o.overrideType === "grant");
  if (grant) return { allowed: true, matchedBy: "user_override_grant" as const, expiresAt: grant.expiresAt };
  return null;
}

/**
 * Pure resolver for unit tests + internal reuse.
 * This does not fetch from Supabase, and assumes `meta` is present and active.
 */
export function resolvePermissionFromContext(args: {
  ctx: AuthzContext;
  input: PermissionCheckInput;
  meta: PermissionMeta;
  dependencyFailures?: any[];
}): PermissionCheckResult {
  const { ctx, input, meta } = args;
  const roleCodes = ctx.roleAssignments
    .filter((a) => a.isActive && a.roleActive && !a.roleArchived && notExpired(a.expiresAt))
    .map((a) => a.roleCode);

  if (input.requireActiveUser !== false && !ctx.userActive) {
    return {
      allowed: false,
      permissionKey: input.permissionKey,
      reasonCode: "DENIED_USER_INACTIVE",
      reasonMessage: "User is inactive for this workspace.",
      matchedBy: "none",
      scopeMatched: false,
      riskLevel: meta.riskLevel,
      isCritical: evaluateCriticalAction(input.permissionKey, meta).isCritical,
      resolvedRoleCodes: roleCodes,
    };
  }

  if (roleCodes.length === 0) {
    return {
      allowed: false,
      permissionKey: input.permissionKey,
      reasonCode: "DENIED_NO_ACTIVE_ROLE",
      reasonMessage: "No active role assigned.",
      matchedBy: "none",
      scopeMatched: false,
      riskLevel: meta.riskLevel,
      isCritical: evaluateCriticalAction(input.permissionKey, meta).isCritical,
      resolvedRoleCodes: [],
    };
  }

  const overrideDecision = isAllowedByOverrides(ctx.overrides, input.permissionKey);
  if (overrideDecision && overrideDecision.allowed === false) {
    return {
      allowed: false,
      permissionKey: input.permissionKey,
      reasonCode: "DENIED_EXPLICIT_USER_OVERRIDE",
      reasonMessage: "Explicit user deny override blocks this permission.",
      matchedBy: "user_override_deny",
      riskLevel: meta.riskLevel,
      isCritical: evaluateCriticalAction(input.permissionKey, meta).isCritical,
      resolvedRoleCodes: roleCodes,
      scopeMatched: false,
      expiresAt: overrideDecision.expiresAt ?? null,
    };
  }

  const grantedByRole = ctx.rolePermissionKeys.includes(input.permissionKey);
  const grantedByOverride = overrideDecision?.allowed === true;
  const granted = grantedByRole || grantedByOverride;
  if (!granted) {
    return {
      allowed: false,
      permissionKey: input.permissionKey,
      reasonCode: "DENIED_PERMISSION_NOT_GRANTED",
      reasonMessage: "Permission not granted.",
      matchedBy: "none",
      riskLevel: meta.riskLevel,
      isCritical: evaluateCriticalAction(input.permissionKey, meta).isCritical,
      resolvedRoleCodes: roleCodes,
      scopeMatched: false,
    };
  }

  if (args.dependencyFailures && args.dependencyFailures.length > 0) {
    return {
      allowed: false,
      permissionKey: input.permissionKey,
      reasonCode: "DENIED_DEPENDENCY_FAILURE",
      reasonMessage: "Required dependency permission(s) missing.",
      matchedBy: "none",
      riskLevel: meta.riskLevel,
      isCritical: evaluateCriticalAction(input.permissionKey, meta).isCritical,
      resolvedRoleCodes: roleCodes,
      scopeMatched: false,
      dependencyFailures: args.dependencyFailures,
    };
  }

  let scopeMatched = true;
  if (meta.scopeType !== "tenant") {
    const m = matchesScope(ctx, { ...input, scopeEntityType: meta.scopeType, requireScope: true });
    scopeMatched = m.matched;
    if (!m.matched) {
      return {
        allowed: false,
        permissionKey: input.permissionKey,
        reasonCode: m.reason === "missing_required" ? "DENIED_SCOPE_REQUIRED" : "DENIED_SCOPE_MISMATCH",
        reasonMessage:
          m.reason === "missing_required"
            ? "Scope is required for this permission."
            : "User has the permission but scope does not match the requested resource.",
        matchedBy: grantedByOverride ? "user_override_grant" : "role",
        riskLevel: meta.riskLevel,
        isCritical: evaluateCriticalAction(input.permissionKey, meta).isCritical,
        resolvedRoleCodes: roleCodes,
        scopeMatched: false,
      };
    }
  }

  const critical = evaluateCriticalAction(input.permissionKey, meta);
  if (critical.isCritical && critical.requiresReason) {
    const reason = input.critical?.reason?.trim();
    if (!reason) {
      return {
        allowed: false,
        permissionKey: input.permissionKey,
        reasonCode: "DENIED_CRITICAL_ACTION_REQUIRES_REASON",
        reasonMessage: "This action requires a reason.",
        matchedBy: grantedByOverride ? "user_override_grant" : "role",
        riskLevel: meta.riskLevel,
        isCritical: true,
        resolvedRoleCodes: roleCodes,
        scopeMatched,
      };
    }
  }

  return {
    allowed: true,
    permissionKey: input.permissionKey,
    reasonCode: "ALLOWED",
    reasonMessage: "Allowed.",
    matchedBy: grantedByOverride ? "user_override_grant" : "role",
    riskLevel: meta.riskLevel,
    isCritical: critical.isCritical,
    resolvedRoleCodes: roleCodes,
    scopeMatched,
    expiresAt: overrideDecision?.expiresAt ?? null,
  };
}

export async function checkPermission(input: PermissionCheckInput): Promise<PermissionCheckResult> {
  if (!isSupabaseConfigured()) {
    return baseDeny(input.permissionKey, "DENIED_NOT_CONFIGURED", "Authorization backend is not configured.");
  }

  const actor = await getServerAuthUser();
  if (!actor) {
    return baseDeny(input.permissionKey, "DENIED_NOT_SIGNED_IN", "Not signed in.");
  }

  // Never trust frontend claims: userId comes from input (target), but actor must be same unless explicitly allowed later.
  if (actor.id !== input.userId) {
    // Pack 2 focuses on a shared engine. Cross-user checks are allowed only via explicit admin flows later.
    return baseDeny(input.permissionKey, "DENIED_TENANT_MISMATCH", "User mismatch for this session.");
  }

  const ctx = await loadAuthzContext({ tenantId: input.tenantId, userId: input.userId });
  if (!ctx) {
    return baseDeny(input.permissionKey, "DENIED_NO_WORKSPACE", "No workspace (tenant) context.");
  }

  if (input.requireActiveUser !== false && !ctx.userActive) {
    return baseDeny(input.permissionKey, "DENIED_USER_INACTIVE", "User is inactive for this workspace.");
  }

  const meta = await (async () => {
    const m = ctx.permissionMetaByKey[input.permissionKey];
    if (m) return m;
    const loaded = await loadPermissionMetaByKeys([input.permissionKey]);
    return loaded[input.permissionKey] ?? null;
  })();

  if (!meta || !meta.isActive) {
    return baseDeny(
      input.permissionKey,
      "DENIED_PERMISSION_NOT_FOUND",
      `Permission not found or inactive: ${input.permissionKey}`,
    );
  }

  const roleCodes = ctx.roleAssignments
    .filter((a) => a.isActive && a.roleActive && !a.roleArchived && notExpired(a.expiresAt))
    .map((a) => a.roleCode);

  if (roleCodes.length === 0) {
    return {
      ...baseDeny(input.permissionKey, "DENIED_NO_ACTIVE_ROLE", "No active role assigned."),
      riskLevel: meta.riskLevel,
      resolvedRoleCodes: [],
      isCritical: evaluateCriticalAction(input.permissionKey, meta).isCritical,
    };
  }

  const overrideDecision = isAllowedByOverrides(ctx.overrides, input.permissionKey);
  if (overrideDecision && overrideDecision.allowed === false) {
    return {
      allowed: false,
      permissionKey: input.permissionKey,
      reasonCode: "DENIED_EXPLICIT_USER_OVERRIDE",
      reasonMessage: "Explicit user deny override blocks this permission.",
      matchedBy: "user_override_deny",
      riskLevel: meta.riskLevel,
      isCritical: evaluateCriticalAction(input.permissionKey, meta).isCritical,
      resolvedRoleCodes: roleCodes,
      expiresAt: overrideDecision.expiresAt ?? null,
    };
  }

  const grantedByRole = ctx.rolePermissionKeys.includes(input.permissionKey);
  const grantedByOverride = overrideDecision?.allowed === true;
  const granted = grantedByRole || grantedByOverride;

  if (!granted) {
    return {
      ...baseDeny(input.permissionKey, "DENIED_PERMISSION_NOT_GRANTED", "Permission not granted."),
      riskLevel: meta.riskLevel,
      resolvedRoleCodes: roleCodes,
      isCritical: evaluateCriticalAction(input.permissionKey, meta).isCritical,
    };
  }

  // Dependencies: all required permissions must resolve true (with same scope input).
  const deps = dependencyWalk(ctx, input.permissionKey, new Set<string>());
  const dependencyFailures: any[] = [];
  for (const depKey of deps) {
    const depRes = await checkPermission({ ...input, permissionKey: depKey, critical: undefined });
    if (!depRes.allowed) {
      dependencyFailures.push({
        permissionKey: input.permissionKey,
        requiredPermissionKey: depKey,
        result: depRes,
      });
    }
  }
  if (dependencyFailures.length > 0) {
    return {
      allowed: false,
      permissionKey: input.permissionKey,
      reasonCode: "DENIED_DEPENDENCY_FAILURE",
      reasonMessage: "Required dependency permission(s) missing.",
      matchedBy: "none",
      riskLevel: meta.riskLevel,
      isCritical: evaluateCriticalAction(input.permissionKey, meta).isCritical,
      dependencyFailures,
      resolvedRoleCodes: roleCodes,
    };
  }

  // Scope rules: if permission is scoped, scope match is required.
  const scopeType = meta.scopeType;
  let scopeMatched = true;
  if (scopeType !== "tenant") {
    const scopeInput: PermissionCheckInput = {
      ...input,
      scopeEntityType: scopeType,
      requireScope: true,
    };
    const m = matchesScope(ctx, scopeInput);
    scopeMatched = m.matched;
    if (!m.matched) {
      return {
        allowed: false,
        permissionKey: input.permissionKey,
        reasonCode: m.reason === "missing_required" ? "DENIED_SCOPE_REQUIRED" : "DENIED_SCOPE_MISMATCH",
        reasonMessage:
          m.reason === "missing_required"
            ? "Scope is required for this permission."
            : "User has the permission but scope does not match the requested resource.",
        matchedBy: grantedByOverride ? "user_override_grant" : "role",
        riskLevel: meta.riskLevel,
        isCritical: evaluateCriticalAction(input.permissionKey, meta).isCritical,
        resolvedRoleCodes: roleCodes,
        scopeMatched: false,
      };
    }
  }

  // Critical action framework (reason/step-up hooks).
  const critical = evaluateCriticalAction(input.permissionKey, meta);
  if (critical.isCritical && critical.requiresReason) {
    const reason = input.critical?.reason?.trim();
    if (!reason) {
      return {
        allowed: false,
        permissionKey: input.permissionKey,
        reasonCode: "DENIED_CRITICAL_ACTION_REQUIRES_REASON",
        reasonMessage: "This action requires a reason.",
        matchedBy: grantedByOverride ? "user_override_grant" : "role",
        riskLevel: meta.riskLevel,
        isCritical: true,
        resolvedRoleCodes: roleCodes,
        scopeMatched,
      };
    }
  }
  if (critical.isCritical && critical.requiresStepUp) {
    return {
      allowed: false,
      permissionKey: input.permissionKey,
      reasonCode: "DENIED_CRITICAL_ACTION_REQUIRES_STEP_UP",
      reasonMessage: "This action requires step-up authentication.",
      matchedBy: grantedByOverride ? "user_override_grant" : "role",
      riskLevel: meta.riskLevel,
      isCritical: true,
      resolvedRoleCodes: roleCodes,
      scopeMatched,
    };
  }

  return {
    allowed: true,
    permissionKey: input.permissionKey,
    reasonCode: "ALLOWED",
    reasonMessage: "Allowed.",
    matchedBy: grantedByOverride ? "user_override_grant" : "role",
    riskLevel: meta.riskLevel,
    isCritical: critical.isCritical,
    resolvedRoleCodes: roleCodes,
    scopeMatched,
    expiresAt: overrideDecision?.expiresAt ?? null,
  };
}

export async function checkPermissions(inputs: PermissionCheckInput[]): Promise<PermissionCheckResult[]> {
  const out: PermissionCheckResult[] = [];
  for (const i of inputs) out.push(await checkPermission(i));
  return out;
}

export async function hasPermission(input: PermissionCheckInput): Promise<boolean> {
  const r = await checkPermission(input);
  return r.allowed;
}

