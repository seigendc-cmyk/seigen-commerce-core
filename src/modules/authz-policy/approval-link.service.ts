import { submitApprovalRequest } from "@/modules/desk/services/approval-engine";
import type { ApprovalExecutionMode, ApprovalPriority } from "@/modules/desk/types/approval";
import { insertApprovalExecutionLink } from "./persistence";

export function moduleKeyFromPermission(permissionKey: string, moduleOverride?: string): string {
  return moduleOverride ?? permissionKey.split(".")[0] ?? "governance";
}

export function actionKeyFromInput(permissionKey: string, actionCode?: string): string {
  return actionCode && actionCode.length > 0 ? actionCode : permissionKey;
}

export async function createApprovalForSensitiveAction(input: {
  tenantId: string;
  userId: string;
  permissionKey: string;
  actionCode: string;
  module?: string;
  entityType: string;
  entityId: string;
  title: string;
  summary: string;
  reason: string;
  branchId?: string | null;
  priority?: ApprovalPriority;
  executionMode?: ApprovalExecutionMode;
  metadata?: Record<string, unknown>;
}): Promise<{ ok: true; approvalRequestRef: string } | { ok: false; error: string }> {
  const moduleKey = moduleKeyFromPermission(input.permissionKey, input.module);
  const actionKey = actionKeyFromInput(input.permissionKey, input.actionCode);

  const req = submitApprovalRequest({
    tenantId: input.tenantId,
    branchId: input.branchId ?? null,
    moduleKey,
    actionKey,
    entityType: input.entityType,
    entityId: input.entityId,
    title: input.title,
    summary: input.summary,
    reason: input.reason,
    priority: input.priority ?? "high",
    initiatedByStaffId: input.userId,
    initiatedByLabel: input.userId,
    executionMode: input.executionMode ?? "approve_then_execute",
    metadata: {
      permissionKey: input.permissionKey,
      governancePack: 4,
      ...input.metadata,
    },
  });

  const link = await insertApprovalExecutionLink({
    tenantId: input.tenantId,
    permissionKey: input.permissionKey,
    actionCode: actionKey,
    entityType: input.entityType,
    entityId: input.entityId,
    requestingUserId: input.userId,
    approvalRequestRef: req.id,
    status: "pending",
    metadata: { deskApproval: true },
  });

  if (!link.ok) {
    // Desk approval still created; UI can proceed without Supabase mirror
    return { ok: true, approvalRequestRef: req.id };
  }

  return { ok: true, approvalRequestRef: req.id };
}
