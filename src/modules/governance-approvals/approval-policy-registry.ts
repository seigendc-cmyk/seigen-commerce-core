import type { ApprovalPolicyDefinition } from "./types";

/**
 * Strongly typed default policies (can later be overridden by DB policies).
 * These remain permission-linked by `policyCode` selection in the sensitive action policy layer.
 */
export const DEFAULT_APPROVAL_POLICIES: ApprovalPolicyDefinition[] = [
  {
    policyCode: "pos_void_manager_approval",
    name: "POS void manager approval",
    description: "Voids require manager review to prevent abuse.",
    riskLevel: "high",
    expiresInMinutes: 60 * 8,
    slaTargetMinutes: 60,
    stages: [
      { stageOrder: 1, stageCode: "mgr", approverType: "branch_manager", requiredApprovalsCount: 1, blockSelfApproval: true, dueInMinutes: 60 },
    ],
    executionHandlerCode: "pos.void_sale",
  },
  {
    policyCode: "stock_adjustment_high_variance_review",
    name: "High variance stock adjustment",
    description: "High variance adjustments require manager approval and escalation.",
    riskLevel: "high",
    expiresInMinutes: 60 * 24,
    slaTargetMinutes: 120,
    stages: [
      { stageOrder: 1, stageCode: "branch_mgr", approverType: "branch_manager", requiredApprovalsCount: 1, blockSelfApproval: true, dueInMinutes: 120 },
      { stageOrder: 2, stageCode: "sysadmin", approverType: "sysadmin", requiredApprovalsCount: 1, blockSelfApproval: true, dueInMinutes: 60 * 12 },
    ],
    executionHandlerCode: "inventory.post_adjustment",
  },
  {
    policyCode: "finance_period_reopen_dual_control",
    name: "Finance period reopen dual control",
    description: "Period reopen requires finance controller then owner/director.",
    riskLevel: "critical",
    expiresInMinutes: 60 * 48,
    slaTargetMinutes: 240,
    stages: [
      { stageOrder: 1, stageCode: "finance_controller", approverType: "finance_controller", requiredApprovalsCount: 1, blockSelfApproval: true, dueInMinutes: 240 },
      { stageOrder: 2, stageCode: "sysadmin", approverType: "sysadmin", requiredApprovalsCount: 1, blockSelfApproval: true, dueInMinutes: 60 * 24 },
    ],
    executionHandlerCode: "finance.reopen_period",
  },
  {
    policyCode: "role_assignment_security_review",
    name: "Role assignment security review",
    description: "Sensitive role assignment requires sysadmin review and execution job audit.",
    riskLevel: "critical",
    expiresInMinutes: 60 * 24,
    slaTargetMinutes: 120,
    stages: [
      { stageOrder: 1, stageCode: "sysadmin", approverType: "sysadmin", requiredApprovalsCount: 1, blockSelfApproval: true, dueInMinutes: 120 },
    ],
    executionHandlerCode: "system.apply_role_assignment",
  },
  {
    policyCode: "audit_export_security_review",
    name: "Audit export security review",
    description: "Exporting audit data is security sensitive and may require review.",
    riskLevel: "critical",
    expiresInMinutes: 60 * 12,
    slaTargetMinutes: 60,
    stages: [
      { stageOrder: 1, stageCode: "sysadmin", approverType: "sysadmin", requiredApprovalsCount: 1, blockSelfApproval: true, dueInMinutes: 60 },
    ],
    executionHandlerCode: "system.audit_export",
  },
];

export function getApprovalPolicy(policyCode: string): ApprovalPolicyDefinition | null {
  return DEFAULT_APPROVAL_POLICIES.find((p) => p.policyCode === policyCode) ?? null;
}

