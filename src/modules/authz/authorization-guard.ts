import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";
import { authorize, authorizeOrThrow } from "./authorization.service";
import { AuthorizationDeniedError } from "./errors";
import type { PermissionCheckInput, PermissionCheckResult } from "./types";

/**
 * Server Action helper: resolves tenantId + userId from session by default.
 * This is the safest preferred pattern for modules.
 */
export async function authorizeForCurrentUser(input: Omit<PermissionCheckInput, "tenantId" | "userId">): Promise<PermissionCheckResult> {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!user || !ws?.tenant?.id) {
    return {
      allowed: false,
      permissionKey: input.permissionKey,
      reasonCode: !user ? "DENIED_NOT_SIGNED_IN" : "DENIED_NO_WORKSPACE",
      reasonMessage: !user ? "Not signed in." : "No workspace (tenant).",
      matchedBy: "none",
      scopeMatched: false,
    };
  }
  return authorize({ ...input, tenantId: ws.tenant.id, userId: user.id });
}

export async function authorizeOrThrowForCurrentUser(input: Omit<PermissionCheckInput, "tenantId" | "userId">) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!user || !ws?.tenant?.id) {
    const res = await authorizeForCurrentUser(input);
    throw new AuthorizationDeniedError(res);
  }
  return authorizeOrThrow({ ...input, tenantId: ws.tenant.id, userId: user.id });
}

export function withAuthorization<TArg, TResult>(
  permissionKey: string,
  handler: (arg: TArg) => Promise<TResult>,
): (arg: TArg & { criticalReason?: string }) => Promise<TResult | { ok: false; denied: PermissionCheckResult }> {
  return async (arg: any) => {
    const res = await authorizeForCurrentUser({
      permissionKey,
      critical: arg?.criticalReason ? { reason: String(arg.criticalReason) } : undefined,
    });
    if (!res.allowed) return { ok: false, denied: res };
    return handler(arg);
  };
}

