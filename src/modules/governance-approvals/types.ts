import type { AuthzRiskLevel } from "@/modules/authz/constants";

export type ApprovalRequestStatus =
  | "draft"
  | "pending"
  | "partially_approved"
  | "approved"
  | "rejected"
  | "cancelled"
  | "expired"
  | "escalated"
  | "executed"
  | "execution_failed";

export type ApprovalStageStatus = "pending" | "completed" | "rejected" | "skipped" | "escalated" | "expired";

export type ApprovalApproverType =
  | "role"
  | "user"
  | "desk"
  | "branch_manager"
  | "finance_controller"
  | "sysadmin";

export type ApprovalStageActionType = "approve" | "reject" | "delegate" | "request_info" | "escalate" | "comment";

export type ApprovalPolicyStageDefinition = {
  stageOrder: number;
  stageCode: string;
  approverType: ApprovalApproverType;
  approverRoleCode?: string | null;
  requiredApprovalsCount: number;
  /** If true, requester may not approve this stage. */
  blockSelfApproval?: boolean;
  /** Minutes until stage due (SLA). */
  dueInMinutes?: number;
};

export type ApprovalPolicyDefinition = {
  policyCode: string;
  name: string;
  description: string;
  riskLevel: AuthzRiskLevel;
  expiresInMinutes?: number;
  slaTargetMinutes?: number;
  stages: ApprovalPolicyStageDefinition[];
  /** Execution handler code after approval (job handler registry). */
  executionHandlerCode: string;
};

export type ApprovalRequestRow = {
  id: string;
  tenantId: string;
  approvalPolicyCode: string;
  permissionKey: string;
  actionCode: string;
  moduleCode: string;
  entityType: string;
  entityId: string | null;
  requestingUserId: string;
  requestingRoleCode: string | null;
  branchId: string | null;
  warehouseId: string | null;
  terminalId: string | null;
  reason: string | null;
  payloadJson: Record<string, unknown>;
  status: ApprovalRequestStatus;
  riskLevel: AuthzRiskLevel;
  dueAt: string | null;
  expiresAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  executedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApprovalStageRow = {
  id: string;
  approvalRequestId: string;
  stageOrder: number;
  stageCode: string;
  approverType: ApprovalApproverType;
  approverRoleCode: string | null;
  approverUserId: string | null;
  approverScopeJson: Record<string, unknown> | null;
  requiredApprovalsCount: number;
  status: ApprovalStageStatus;
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type ApprovalActionRow = {
  id: string;
  approvalRequestId: string;
  approvalRequestStageId: string;
  actorUserId: string | null;
  action: ApprovalStageActionType;
  comment: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type ExecutionJobStatus = "pending" | "ready" | "running" | "completed" | "failed" | "cancelled";

export type ExecutionJobRow = {
  id: string;
  approvalRequestId: string;
  executionKey: string;
  status: ExecutionJobStatus;
  handlerCode: string;
  payloadJson: Record<string, unknown>;
  resultJson: Record<string, unknown> | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

