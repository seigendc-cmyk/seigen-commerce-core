export type ComplianceCaseType =
  | "compliance_exception"
  | "security_incident"
  | "policy_breach"
  | "audit_issue"
  | "financial_irregularity"
  | "delivery_dispute"
  | "consignment_dispute"
  | "role_misuse"
  | "override_abuse"
  | "governance_exception"
  | "legal_review"
  | "board_matter";

export type ComplianceCaseStatus =
  | "open"
  | "under_review"
  | "investigating"
  | "awaiting_response"
  | "escalated"
  | "resolved"
  | "closed"
  | "dismissed";

export type ComplianceSeverity = "low" | "medium" | "high" | "critical";

export type ComplianceOriginSourceType = "workflow" | "alert" | "manual" | "anomaly" | "helpdesk" | "approval_request" | "audit";

export type ComplianceCaseRow = {
  id: string;
  tenantId: string;
  caseCode: string;
  caseType: ComplianceCaseType;
  title: string;
  summary: string;
  status: ComplianceCaseStatus;
  severity: ComplianceSeverity;
  originSourceType: ComplianceOriginSourceType;
  originSourceId: string | null;
  requestingUserId: string | null;
  assignedToUserId: string | null;
  assignedRoleCode: string | null;
  branchId: string | null;
  moduleCode: string | null;
  entityType: string | null;
  entityId: string | null;
  riskSummaryJson: Record<string, unknown>;
  resolutionSummary: string | null;
  requiresLegalReview: boolean;
  requiresExecutiveVisibility: boolean;
  requiresTrustVisibility: boolean;
  openedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ComplianceCaseEventRow = {
  id: string;
  complianceCaseId: string;
  eventCode: string;
  title: string;
  summary: string;
  actorUserId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type ComplianceCaseLinkRow = {
  id: string;
  complianceCaseId: string;
  linkType: string;
  linkedId: string;
  linkedCode: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

