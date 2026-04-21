import type { AuthzReasonCode } from "@/modules/authz/constants";
import type { PermissionCheckResult } from "@/modules/authz/types";

export type ThresholdType =
  | "none"
  | "amount"
  | "quantity"
  | "variance"
  | "percentage"
  | "margin_delta"
  | "record_age";

export type ExecutionPolicyRow = {
  id: string;
  tenantId: string | null;
  permissionKey: string;
  requiresReason: boolean;
  requiresStepUp: boolean;
  requiresApproval: boolean;
  approvalPolicyCode: string | null;
  stepUpPolicyCode: string | null;
  thresholdType: ThresholdType | null;
  thresholdValue: number | null;
  appliesWhenJson: Record<string, unknown> | null;
  riskLevelOverride: string | null;
  isActive: boolean;
};

export type PolicyEvaluationContext = {
  amount?: number;
  quantity?: number;
  variance?: number;
  percentage?: number;
  marginDelta?: number;
  recordAgeHours?: number;
  branchId?: string | null;
  /** e.g. dispatch already assigned */
  dispatchAssigned?: boolean;
  [key: string]: unknown;
};

export type PolicyEvaluationResult = {
  policy: ExecutionPolicyRow | null;
  /** When true, approval flow must run before execution (threshold / applies_when satisfied). */
  approvalRequired: boolean;
  /** When true, step-up verification must complete first. */
  stepUpRequired: boolean;
  /** Policy-level reason (in addition to critical-action reason in RBAC). */
  reasonRequired: boolean;
  thresholdTriggered: boolean;
  appliesWhenMatched: boolean;
};

export type SensitiveActionOutcome =
  | "allowed_execute_now"
  | "reason_required"
  | "step_up_required"
  | "approval_required"
  | "pending_approval"
  | "pending_step_up"
  | "denied";

export type SensitiveActionInput = {
  tenantId: string;
  userId: string;
  permissionKey: string;
  actionCode: string;
  module?: string;
  entityType?: string;
  entityId?: string | null;
  branchId?: string | null;
  deskCode?: string | null;
  reason?: string | null;
  /** Step-up completion token / future OTP payload */
  stepUpToken?: string | null;
  /** Linked approval request (desk ref or future UUID) when resuming */
  approvalRequestRef?: string | null;
  policyContext?: PolicyEvaluationContext;
  /** Scope for permission resolver */
  scopeEntityType?: import("@/modules/authz/constants").AuthzScopeEntityType;
  scopeEntityId?: string;
  scopeCode?: string;
  metadata?: Record<string, unknown>;
};

export type SensitiveActionResult = {
  outcome: SensitiveActionOutcome;
  permissionResult?: PermissionCheckResult;
  policy?: PolicyEvaluationResult | null;
  /** Desk / engine reference */
  approvalRequestRef?: string | null;
  stepUpEventId?: string | null;
  denialExplanation?: DenialExplanation;
  /** Machine codes for UI + BI */
  codes: {
    technicalReasonCode: string;
    policyApprovalCode?: string | null;
    policyStepUpCode?: string | null;
  };
  auditMetadata: Record<string, unknown>;
};

export type DenialExplanation = {
  title: string;
  summary: string;
  technicalReasonCode: AuthzReasonCode | string;
  userMessage: string;
  adminMessage: string;
  recommendedAction: string;
  helpDeskHint: string;
  isRetryable: boolean;
  shouldEscalate: boolean;
  relatedDeskOrRole: string | null;
  severity: "info" | "warning" | "critical";
};

export type StepUpAdapterResult =
  | { ok: true; verifiedByUserId?: string | null }
  | { ok: false; error: string };
