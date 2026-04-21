export type GovernancePolicyStatus = "draft" | "in_review" | "approved" | "published" | "superseded" | "archived";
export type GovernancePolicyVersionStatus = "draft" | "submitted" | "approved" | "published" | "rejected" | "withdrawn" | "superseded";

export type GovernancePolicyRow = {
  id: string;
  tenantId: string | null;
  policyCode: string;
  policyType: string;
  title: string;
  description: string | null;
  owningModuleCode: string;
  status: GovernancePolicyStatus;
  currentVersionNumber: number;
  isSystem: boolean;
  isProtected: boolean;
  requiresApproval: boolean;
  requiresExecutiveVisibility: boolean;
  requiresTrustVisibility: boolean;
};

export type GovernancePolicyVersionRow = {
  id: string;
  governancePolicyId: string;
  versionNumber: number;
  versionStatus: GovernancePolicyVersionStatus;
  changeSummary: string;
  policyDefinitionJson: Record<string, unknown>;
  effectiveFrom: string;
  effectiveTo: string | null;
  publishedAt: string | null;
};

export type PolicyDiff = {
  changedKeys: string[];
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  summary: string;
};

