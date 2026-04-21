import type { DeskAccessResult } from "./types";
import type { DeskCode } from "./constants";
import { DESK_CODES, DESK_PERMISSION_KEY_BY_CODE } from "./constants";
import { authorize } from "./authorization.service";

export async function canAccessDesk(tenantId: string, userId: string, deskCode: DeskCode): Promise<DeskAccessResult> {
  const permissionKey = DESK_PERMISSION_KEY_BY_CODE[deskCode];
  const res = await authorize({
    tenantId,
    userId,
    permissionKey,
    scopeEntityType: "desk",
    scopeCode: deskCode,
    requireScope: false,
  });
  return {
    deskCode,
    allowed: res.allowed,
    matchedPermissionKey: permissionKey,
    scopeMatched: res.scopeMatched ?? true,
    source: res.matchedBy === "user_override_grant" ? "override" : res.matchedBy === "role" ? "role" : "none",
  };
}

export async function listAccessibleDesks(tenantId: string, userId: string): Promise<DeskAccessResult[]> {
  const out: DeskAccessResult[] = [];
  for (const d of DESK_CODES) out.push(await canAccessDesk(tenantId, userId, d));
  return out.filter((d) => d.allowed);
}

export async function getDefaultDeskLanding(tenantId: string, userId: string): Promise<DeskCode | null> {
  const desks = await listAccessibleDesks(tenantId, userId);
  if (desks.length === 0) return null;
  // Simple ordering preference (can be upgraded later).
  const priority: DeskCode[] = ["sysadmin_desk", "executive_desk", "finance_desk", "inventory_desk", "pos_desk", "branch_desk"];
  for (const p of priority) {
    if (desks.some((d) => d.deskCode === p)) return p;
  }
  return desks[0].deskCode;
}

