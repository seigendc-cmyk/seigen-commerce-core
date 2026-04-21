import type { ApprovalPolicyDefinition, ApprovalPolicyStageDefinition } from "./types";

export type ApprovalRoutingContext = {
  tenantId: string;
  branchId?: string | null;
  warehouseId?: string | null;
  terminalId?: string | null;
  requestingUserId: string;
  requestingRoleCode?: string | null;
};

/**
 * Resolves stage assignees.
 * Pack 5 keeps this conservative: by default role-based stages are mapped to canonical role codes.
 * In later packs, this can expand to org hierarchies, regional routing, and dynamic desk ownership.
 */
export function resolveStageAssignee(stage: ApprovalPolicyStageDefinition, ctx: ApprovalRoutingContext): { approverRoleCode: string | null; approverUserId: string | null; approverScopeJson: Record<string, unknown> | null } {
  void ctx;
  if (stage.approverType === "user") {
    return { approverRoleCode: null, approverUserId: null, approverScopeJson: null };
  }
  if (stage.approverType === "sysadmin") {
    return { approverRoleCode: "admin", approverUserId: null, approverScopeJson: { scope: "tenant" } };
  }
  if (stage.approverType === "finance_controller") {
    return { approverRoleCode: "accountant", approverUserId: null, approverScopeJson: { scope: "tenant" } };
  }
  if (stage.approverType === "branch_manager") {
    return { approverRoleCode: "branch_manager", approverUserId: null, approverScopeJson: { scope: "branch" } };
  }
  if (stage.approverType === "role") {
    return { approverRoleCode: stage.approverRoleCode ?? null, approverUserId: null, approverScopeJson: { scope: "tenant" } };
  }
  if (stage.approverType === "desk") {
    return { approverRoleCode: "admin", approverUserId: null, approverScopeJson: { scope: "desk" } };
  }
  return { approverRoleCode: null, approverUserId: null, approverScopeJson: null };
}

export function computeDueAt(def: ApprovalPolicyStageDefinition, now = new Date()): string | null {
  if (!def.dueInMinutes) return null;
  return new Date(now.getTime() + def.dueInMinutes * 60_000).toISOString();
}

export function computeExpiresAt(policy: ApprovalPolicyDefinition, now = new Date()): string | null {
  if (!policy.expiresInMinutes) return null;
  return new Date(now.getTime() + policy.expiresInMinutes * 60_000).toISOString();
}

