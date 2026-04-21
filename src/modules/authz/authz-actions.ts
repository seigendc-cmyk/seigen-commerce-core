"use server";

import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";
import type { PermissionCheckResult } from "./types";
import { authorizeForCurrentUser } from "./authorization-guard";
import { getEffectiveAccessSnapshot } from "./effective-access.service";
import { assignRoleToUser, removeRoleFromUser, setPrimaryRole, listUserRoles } from "./role-assignment.service";
import { grantPermissionToUser, denyPermissionToUser, removeOverride, listUserOverrides } from "./user-override.service";

export async function authzCheck(permissionKey: string, opts?: { scopeEntityType?: any; scopeEntityId?: string; scopeCode?: string; criticalReason?: string }): Promise<PermissionCheckResult> {
  return authorizeForCurrentUser({
    permissionKey,
    scopeEntityType: opts?.scopeEntityType,
    scopeEntityId: opts?.scopeEntityId,
    scopeCode: opts?.scopeCode,
    critical: opts?.criticalReason ? { reason: opts.criticalReason } : undefined,
  });
}

export async function authzSnapshot(): Promise<{ ok: true; snapshot: any } | { ok: false; error: string }> {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false, error: "Not signed in / no workspace" };
  const snap = await getEffectiveAccessSnapshot(ws.tenant.id, user.id);
  if (!snap) return { ok: false, error: "Not available" };
  return { ok: true, snapshot: snap };
}

// Governance actions (write ops) — these are the Pack 2 API surface
export async function authzAssignRole(input: { targetUserId: string; roleId: string; isPrimary?: boolean; expiresAt?: string | null; reason?: string }) {
  return assignRoleToUser(input);
}
export async function authzRemoveRole(input: { userRoleId: string; reason?: string }) {
  return removeRoleFromUser(input);
}
export async function authzSetPrimaryRole(input: { userRoleId: string; reason?: string }) {
  return setPrimaryRole(input);
}
export async function authzListUserRoles(targetUserId: string) {
  return listUserRoles(targetUserId);
}

export async function authzGrantOverride(input: { targetUserId: string; permissionKey: string; expiresAt?: string | null; reason?: string | null }) {
  return grantPermissionToUser(input);
}
export async function authzDenyOverride(input: { targetUserId: string; permissionKey: string; expiresAt?: string | null; reason?: string | null }) {
  return denyPermissionToUser(input);
}
export async function authzRemoveOverride(input: { overrideId: string; reason?: string | null }) {
  return removeOverride(input);
}
export async function authzListUserOverrides(targetUserId: string) {
  return listUserOverrides(targetUserId);
}

