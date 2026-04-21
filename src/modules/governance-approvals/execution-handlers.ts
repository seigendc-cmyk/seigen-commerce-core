import { authzAssignRole } from "@/modules/authz/authz-actions";

export type ExecutionHandler = (payload: Record<string, unknown>) => Promise<{ ok: true; result?: Record<string, unknown> } | { ok: false; error: string; result?: Record<string, unknown> }>;

/**
 * Pack 5 handler registry.
 * Keep handlers centralized and idempotent — they must tolerate retries.
 */
export const EXECUTION_HANDLERS: Record<string, ExecutionHandler> = {
  "system.apply_role_assignment": async (payload) => {
    const targetUserId = String(payload.targetUserId ?? "");
    const roleId = String(payload.roleId ?? "");
    if (!targetUserId || !roleId) return { ok: false, error: "Missing targetUserId/roleId in payload." };
    const res: any = await authzAssignRole({ targetUserId, roleId, isPrimary: Boolean(payload.isPrimary), reason: String(payload.reason ?? "Approved role assignment") });
    if (!res?.ok) return { ok: false, error: res?.error ?? "Role assignment failed", result: { res } };
    return { ok: true, result: { userRoleId: res.userRole?.id ?? null } };
  },
  // Stubs for cross-module jobs (wired in Pack 6):
  "inventory.post_adjustment": async () => ({ ok: false, error: "Handler not wired yet (Pack 6)." }),
  "finance.reopen_period": async () => ({ ok: false, error: "Handler not wired yet (Pack 6)." }),
  "pos.void_sale": async () => ({ ok: false, error: "Handler not wired yet (Pack 6)." }),
  "system.audit_export": async () => ({ ok: false, error: "Handler not wired yet (Pack 6)." }),
};

