import type { ComplianceCaseType, ComplianceSeverity } from "./types";

export function routeCase(input: {
  caseType: ComplianceCaseType;
  severity: ComplianceSeverity;
  moduleCode?: string | null;
}): { assignedRoleCode: string; requiresLegalReview: boolean; requiresExecutiveVisibility: boolean; requiresTrustVisibility: boolean } {
  const t = input.caseType;
  const sev = input.severity;

  if (t === "override_abuse" || t === "role_misuse" || t === "security_incident") {
    return {
      assignedRoleCode: "admin",
      requiresLegalReview: false,
      requiresExecutiveVisibility: sev === "critical",
      requiresTrustVisibility: sev === "critical" || t === "security_incident",
    };
  }

  if (t === "financial_irregularity" || t === "audit_issue") {
    return {
      assignedRoleCode: "accountant",
      requiresLegalReview: false,
      requiresExecutiveVisibility: sev === "high" || sev === "critical",
      requiresTrustVisibility: sev === "critical",
    };
  }

  if (t === "consignment_dispute" || t === "legal_review" || t === "board_matter") {
    return {
      assignedRoleCode: "admin",
      requiresLegalReview: true,
      requiresExecutiveVisibility: true,
      requiresTrustVisibility: true,
    };
  }

  // Default compliance reviewer
  return {
    assignedRoleCode: "admin",
    requiresLegalReview: false,
    requiresExecutiveVisibility: sev === "critical",
    requiresTrustVisibility: false,
  };
}

