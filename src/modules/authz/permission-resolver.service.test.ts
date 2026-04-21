import { describe, expect, it } from "vitest";
import { resolvePermissionFromContext } from "./permission-resolver.service";
import type { AuthzContext, PermissionMeta } from "./types";

function baseCtx(): AuthzContext {
  return {
    tenantId: "t1",
    userId: "u1",
    userActive: true,
    roleAssignments: [
      {
        id: "ur1",
        roleId: "r1",
        roleCode: "cashier",
        roleName: "Cashier",
        roleActive: true,
        roleArchived: false,
        isPrimary: true,
        isActive: true,
        expiresAt: null,
      },
    ],
    rolePermissionKeys: [],
    overrides: [],
    scopes: [],
    permissionMetaByKey: {},
    dependenciesByPermissionKey: {},
  };
}

function meta(permissionKey: string, patch?: Partial<PermissionMeta>): PermissionMeta {
  return {
    id: "p1",
    permissionKey,
    label: permissionKey,
    description: null,
    moduleCode: "x",
    categoryCode: "x",
    resourceCode: "x",
    actionCode: "x",
    riskLevel: "medium",
    scopeType: "tenant",
    isProtected: false,
    isDestructive: false,
    isApprovalCapable: false,
    isActive: true,
    metadata: {},
    ...patch,
  };
}

describe("authz permission resolution", () => {
  it("role grants permission", () => {
    const ctx = baseCtx();
    ctx.rolePermissionKeys = ["inventory.adjustment.post"];
    const r = resolvePermissionFromContext({
      ctx,
      meta: meta("inventory.adjustment.post", { riskLevel: "high" }),
      input: { tenantId: "t1", userId: "u1", permissionKey: "inventory.adjustment.post" },
    });
    expect(r.allowed).toBe(true);
    expect(r.matchedBy).toBe("role");
  });

  it("no role denies permission", () => {
    const ctx = baseCtx();
    ctx.roleAssignments = [];
    const r = resolvePermissionFromContext({
      ctx,
      meta: meta("pos.price.override"),
      input: { tenantId: "t1", userId: "u1", permissionKey: "pos.price.override" },
    });
    expect(r.allowed).toBe(false);
    expect(r.reasonCode).toBe("DENIED_NO_ACTIVE_ROLE");
  });

  it("user deny override beats role grant", () => {
    const ctx = baseCtx();
    ctx.rolePermissionKeys = ["pos.price.override"];
    ctx.overrides = [
      {
        id: "o1",
        permissionKey: "pos.price.override",
        overrideType: "deny",
        isActive: true,
        expiresAt: null,
        reason: "blocked",
      },
    ];
    const r = resolvePermissionFromContext({
      ctx,
      meta: meta("pos.price.override", { riskLevel: "high" }),
      input: { tenantId: "t1", userId: "u1", permissionKey: "pos.price.override" },
    });
    expect(r.allowed).toBe(false);
    expect(r.reasonCode).toBe("DENIED_EXPLICIT_USER_OVERRIDE");
  });

  it("user grant adds permission", () => {
    const ctx = baseCtx();
    ctx.rolePermissionKeys = [];
    ctx.overrides = [
      {
        id: "o1",
        permissionKey: "reports.audit.view",
        overrideType: "grant",
        isActive: true,
        expiresAt: null,
        reason: null,
      },
    ];
    const r = resolvePermissionFromContext({
      ctx,
      meta: meta("reports.audit.view"),
      input: { tenantId: "t1", userId: "u1", permissionKey: "reports.audit.view" },
    });
    expect(r.allowed).toBe(true);
    expect(r.matchedBy).toBe("user_override_grant");
  });

  it("expired override ignored", () => {
    const ctx = baseCtx();
    ctx.rolePermissionKeys = [];
    ctx.overrides = [
      {
        id: "o1",
        permissionKey: "reports.audit.view",
        overrideType: "grant",
        isActive: true,
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
        reason: null,
      },
    ];
    const r = resolvePermissionFromContext({
      ctx,
      meta: meta("reports.audit.view"),
      input: { tenantId: "t1", userId: "u1", permissionKey: "reports.audit.view" },
    });
    expect(r.allowed).toBe(false);
    expect(r.reasonCode).toBe("DENIED_PERMISSION_NOT_GRANTED");
  });

  it("scope mismatch denied for scoped permission", () => {
    const ctx = baseCtx();
    ctx.rolePermissionKeys = ["inventory.adjustment.post"];
    // user has branch scope for b1, but request is b2
    ctx.scopes = [
      {
        id: "s1",
        scopeEntityType: "branch",
        scopeEntityId: "b1",
        scopeCode: null,
        accessLevel: "allowed",
        isActive: true,
        expiresAt: null,
      },
    ];
    const r = resolvePermissionFromContext({
      ctx,
      meta: meta("inventory.adjustment.post", { scopeType: "branch", riskLevel: "high" }),
      input: { tenantId: "t1", userId: "u1", permissionKey: "inventory.adjustment.post", scopeEntityId: "b2" },
    });
    expect(r.allowed).toBe(false);
    expect(r.reasonCode).toBe("DENIED_SCOPE_MISMATCH");
  });

  it("critical permission requires reason", () => {
    const ctx = baseCtx();
    ctx.rolePermissionKeys = ["finance.period.reopen"];
    const r = resolvePermissionFromContext({
      ctx,
      meta: meta("finance.period.reopen", { riskLevel: "critical" }),
      input: { tenantId: "t1", userId: "u1", permissionKey: "finance.period.reopen" },
    });
    expect(r.allowed).toBe(false);
    expect(r.reasonCode).toBe("DENIED_CRITICAL_ACTION_REQUIRES_REASON");
  });
});

