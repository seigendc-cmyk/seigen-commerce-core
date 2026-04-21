export const COMPLIANCE_CASE_TYPES = [
  "compliance_exception",
  "security_incident",
  "policy_breach",
  "audit_issue",
  "financial_irregularity",
  "delivery_dispute",
  "consignment_dispute",
  "role_misuse",
  "override_abuse",
  "governance_exception",
  "legal_review",
  "board_matter",
] as const;

export const COMPLIANCE_SEVERITIES = ["low", "medium", "high", "critical"] as const;

export const COMPLIANCE_STATUSES = ["open", "under_review", "investigating", "awaiting_response", "escalated", "resolved", "closed", "dismissed"] as const;

