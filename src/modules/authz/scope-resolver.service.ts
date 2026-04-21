import type { AuthzContext, AuthzUserScope, PermissionCheckInput } from "./types";

function notExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() > Date.now();
}

export type ScopeMatchResult = {
  matched: boolean;
  reason?: "missing_required" | "mismatch" | "expired" | "denied_scope_row";
};

export function getActiveUserScopes(ctx: AuthzContext): AuthzUserScope[] {
  return ctx.scopes.filter((s) => s.isActive && notExpired(s.expiresAt));
}

export function matchesScope(ctx: AuthzContext, input: PermissionCheckInput): ScopeMatchResult {
  const requireScope = Boolean(input.requireScope);
  const type = input.scopeEntityType;

  if (!type) {
    return requireScope ? { matched: false, reason: "missing_required" } : { matched: true };
  }

  const active = getActiveUserScopes(ctx);
  if (active.length === 0) {
    return requireScope ? { matched: false, reason: "missing_required" } : { matched: false, reason: "mismatch" };
  }

  // Deny rows take precedence for the same scope target.
  const denies = active.filter((s) => s.accessLevel === "denied" && s.scopeEntityType === type);
  const allows = active.filter((s) => s.accessLevel !== "denied" && s.scopeEntityType === type);

  function isSameTarget(s: AuthzUserScope) {
    if (type === "desk") return (input.scopeCode ?? null) === (s.scopeCode ?? null);
    if (type === "tenant") return true;
    return (input.scopeEntityId ?? null) === (s.scopeEntityId ?? null);
  }

  if (denies.some(isSameTarget)) return { matched: false, reason: "denied_scope_row" };
  if (allows.some(isSameTarget)) return { matched: true };

  // Tenant-wide scope row can satisfy non-tenant checks (broad allowance).
  if (type !== "tenant") {
    const tenantAllows = active.filter((s) => s.scopeEntityType === "tenant" && s.accessLevel !== "denied");
    if (tenantAllows.length > 0) return { matched: true };
  }

  return requireScope ? { matched: false, reason: "mismatch" } : { matched: false, reason: "mismatch" };
}

export function hasDeskScope(ctx: AuthzContext, deskCode: string): boolean {
  const r = matchesScope(ctx, { tenantId: ctx.tenantId, userId: ctx.userId, permissionKey: "_", scopeEntityType: "desk", scopeCode: deskCode, requireScope: true });
  return r.matched;
}

