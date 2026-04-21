/** Policy codes map to routing hints (approval engine / future workflow). */
export const APPROVAL_POLICY_CODES = [
  "default_manager",
  "default_sysadmin",
  "finance_controller",
  "inventory_threshold",
] as const;

export const STEP_UP_POLICY_CODES = [
  "supervisor_passcode",
  "otp_future",
  "re_auth_future",
  "manager_confirmation",
  "dual_control_confirmation",
] as const;

export const GOVERNANCE_AUDIT_ACTIONS = {
  sensitiveRequested: "governance.sensitive_action.requested",
  sensitiveAllowed: "governance.sensitive_action.allowed",
  sensitiveDenied: "governance.sensitive_action.denied",
  reasonMissing: "governance.sensitive_action.reason_missing",
  approvalRequired: "governance.sensitive_action.approval_required",
  approvalLinked: "governance.sensitive_action.approval_linked",
  stepUpRequired: "governance.sensitive_action.step_up_required",
  stepUpCompleted: "governance.sensitive_action.step_up_completed",
  stepUpFailed: "governance.sensitive_action.step_up_failed",
  protectedAttempt: "governance.protected_operation.attempt",
} as const;
