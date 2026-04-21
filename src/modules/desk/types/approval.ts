export type ApprovalPriority = "normal" | "high" | "urgent" | "critical";

export type ApprovalRequestStatus =
  | "draft"
  | "submitted"
  | "pending"
  | "partially_approved"
  | "approved"
  | "rejected"
  | "returned"
  | "escalated"
  | "cancelled"
  | "executed"
  | "closed";

export type ApprovalExecutionMode = "approve_only" | "approve_then_execute" | "approve_and_execute";

export type ApprovalRouteScopeMode = "same_branch" | "cross_branch" | "all";

export type ApprovalApproverMode = "role" | "staff" | "sysadmin";

export type ApprovalRouteStep = {
  stepNumber: number;
  approverMode: ApprovalApproverMode;
  roleIds?: string[];
  staffIds?: string[];
  minApprovalsRequired: number;
  allowReject: boolean;
  allowReturn: boolean;
  allowEscalate: boolean;
};

export type ApprovalRoutePolicy = {
  id: string;
  moduleKey: string;
  actionKey: string;
  name: string;
  description: string;
  branchScopeMode: ApprovalRouteScopeMode;
  steps: ApprovalRouteStep[];
  autoEscalateAfterMinutes?: number;
  isActive: boolean;
};

export type ApprovalRequest = {
  id: string;
  tenantId?: string | null;
  branchId?: string | null;
  moduleKey: string;
  actionKey: string;
  entityType: string;
  entityId: string;
  title: string;
  summary: string;
  reason: string;
  status: ApprovalRequestStatus;
  priority: ApprovalPriority;
  initiatedByStaffId: string;
  initiatedByLabel: string;
  requestedAt: string;
  dueAt?: string | null;
  resolvedAt?: string | null;
  resolvedByStaffId?: string | null;
  resolvedByLabel?: string | null;
  resolutionNote?: string | null;
  linkedNotificationIds: string[];
  currentStep: number;
  totalSteps: number;
  routePolicyId?: string | null;
  escalationLevel: number;
  executionMode: ApprovalExecutionMode;
  payloadBefore?: Record<string, unknown> | null;
  payloadAfter?: Record<string, unknown> | null;
  attachments?: Array<Record<string, unknown>>;
  metadata: Record<string, unknown>;
};

export type ApprovalDecision = {
  id: string;
  requestId: string;
  stepNumber: number;
  actorStaffId: string | null;
  actorLabel: string;
  decision: "approved" | "rejected" | "returned" | "escalated";
  note?: string;
  occurredAt: string;
};

