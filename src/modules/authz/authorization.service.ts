import { AuthorizationDeniedError } from "./errors";
import type { PermissionCheckInput, PermissionCheckResult } from "./types";
import { checkPermission, checkPermissions } from "./permission-resolver.service";
import type { DeskCode } from "./constants";
import { DESK_PERMISSION_KEY_BY_CODE } from "./constants";

export async function authorize(input: PermissionCheckInput): Promise<PermissionCheckResult> {
  return checkPermission(input);
}

export async function authorizeOrThrow(input: PermissionCheckInput): Promise<PermissionCheckResult> {
  const r = await authorize(input);
  if (!r.allowed) throw new AuthorizationDeniedError(r);
  return r;
}

export async function authorizeMany(inputs: PermissionCheckInput[]): Promise<PermissionCheckResult[]> {
  return checkPermissions(inputs);
}

export async function ensureDeskAccess(input: { tenantId: string; userId: string; deskCode: DeskCode }) {
  const permissionKey = DESK_PERMISSION_KEY_BY_CODE[input.deskCode];
  return authorizeOrThrow({
    tenantId: input.tenantId,
    userId: input.userId,
    permissionKey,
    scopeEntityType: "desk",
    scopeCode: input.deskCode,
    requireScope: false,
  });
}

