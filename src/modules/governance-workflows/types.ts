import type { AuthzRiskLevel } from "@/modules/authz/constants";

export type WorkflowStatus =
  | "draft"
  | "pending"
  | "in_review"
  | "approved"
  | "rejected"
  | "partially_approved"
  | "executed"
  | "execution_failed"
  | "cancelled"
  | "closed";

export type WorkflowStepType = "approval" | "step_up" | "review" | "execution" | "notification" | "checkpoint" | "evidence";
export type WorkflowStepStatus = "pending" | "in_progress" | "completed" | "failed" | "skipped" | "blocked";

export type WorkflowInstanceRow = {
  id: string;
  tenantId: string;
  workflowCode: string;
  title: string;
  description: string | null;
  originModuleCode: string;
  originPermissionKey: string;
  originActionCode: string;
  originEntityType: string;
  originEntityId: string | null;
  requestingUserId: string;
  branchId: string | null;
  warehouseId: string | null;
  terminalId: string | null;
  status: WorkflowStatus;
  riskLevel: AuthzRiskLevel;
  executiveVisible: boolean;
  trustVisible: boolean;
  impactSummaryJson: Record<string, unknown>;
  payloadJson: Record<string, unknown>;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowStepRow = {
  id: string;
  governanceWorkflowId: string;
  stepOrder: number;
  stepCode: string;
  stepType: WorkflowStepType;
  moduleCode: string;
  status: WorkflowStepStatus;
  assignedToUserId: string | null;
  assignedToRoleCode: string | null;
  assignedScopeJson: Record<string, unknown> | null;
  dependsOnStepId: string | null;
  payloadJson: Record<string, unknown>;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type WorkflowLinkType =
  | "approval_request"
  | "step_up_event"
  | "alert"
  | "execution_job"
  | "audit_event"
  | "entity"
  | "recommendation";

export type WorkflowLinkRow = {
  id: string;
  governanceWorkflowId: string;
  linkType: WorkflowLinkType;
  linkedId: string;
  linkedCode: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type WorkflowTimelineEventRow = {
  id: string;
  governanceWorkflowId: string;
  eventCode: string;
  title: string;
  summary: string;
  actorUserId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type WorkflowImpactSummary = {
  modulesAffected: string[];
  branchesAffected?: string[];
  financialExposure?: number;
  inventoryExposureQty?: number;
  securitySensitive?: boolean;
  auditSensitive?: boolean;
  trustVisibilitySuggested?: boolean;
  executiveVisibilitySuggested?: boolean;
  notes?: string[];
};

export type StartWorkflowInput = {
  workflowCode: string;
  title: string;
  description?: string | null;
  originModuleCode: string;
  originPermissionKey: string;
  originActionCode: string;
  originEntityType: string;
  originEntityId?: string | null;
  riskLevel: AuthzRiskLevel;
  branchId?: string | null;
  warehouseId?: string | null;
  terminalId?: string | null;
  payloadJson?: Record<string, unknown>;
  impactSummaryJson?: WorkflowImpactSummary;
  executiveVisible?: boolean;
  trustVisible?: boolean;
  /** link an existing approval request if already created */
  approvalRequestId?: string | null;
  /** link an existing execution job if already created */
  executionJobId?: string | null;
  stepUpEventId?: string | null;
};

