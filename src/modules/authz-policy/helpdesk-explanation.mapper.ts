import type { DenialExplanation } from "./types";

export function mapHelpDeskExplanation(input: {
  reasonCode: string;
  permissionKey: string;
  scopeMatched?: boolean;
  dependencyFailures?: Array<{ requiredPermissionKey: string }>;
  policyHint?: string | null;
}): DenialExplanation {
  const pk = input.permissionKey;
  const dep = input.dependencyFailures?.[0]?.requiredPermissionKey;

  const table: Record<string, Omit<DenialExplanation, "technicalReasonCode">> = {
    DENIED_PERMISSION_NOT_GRANTED: {
      title: "Missing permission",
      summary: `Your roles do not include ${pk}.`,
      userMessage: "You do not have access to perform this action for your workspace.",
      adminMessage: `Blocked by permission ${pk}. Grant via role assignment or a time-bound override.`,
      recommendedAction: "Ask a SysAdmin or Branch Manager to review your role.",
      helpDeskHint: `Verify role templates include ${pk} and branch/desk scope matches the resource.`,
      isRetryable: false,
      shouldEscalate: false,
      relatedDeskOrRole: "sysadmin_desk",
      severity: "warning",
    },
    DENIED_SCOPE_MISMATCH: {
      title: "Wrong branch or scope",
      summary: "This permission is limited to a branch, desk, or terminal scope.",
      userMessage: "You cannot act on this resource because it is outside your assigned scope.",
      adminMessage: `Scope mismatch for ${pk}. User may hold the permission globally but scope rules block this target.`,
      recommendedAction: "Adjust user access scope or pick a resource within the allowed branch/desk.",
      helpDeskHint: "Check user_access_scopes and permission scope_type vs requested entity.",
      isRetryable: true,
      shouldEscalate: false,
      relatedDeskOrRole: "branch_desk",
      severity: "warning",
    },
    DENIED_SCOPE_REQUIRED: {
      title: "Scope required",
      summary: "This action needs a branch, warehouse, terminal, or desk context.",
      userMessage: "Choose a valid store or terminal context and try again.",
      adminMessage: `Permission ${pk} requires explicit scope selection.`,
      recommendedAction: "Pass scopeEntityType/scopeEntityId from the UI flow.",
      helpDeskHint: "Often missing branch_id on POS/inventory mutations.",
      isRetryable: true,
      shouldEscalate: false,
      relatedDeskOrRole: "help_desk",
      severity: "info",
    },
    DENIED_EXPLICIT_USER_OVERRIDE: {
      title: "Access explicitly denied",
      summary: "A deny override is active for this permission.",
      userMessage: "Your account is explicitly blocked from this action.",
      adminMessage: `user_permission_overrides deny for ${pk}.`,
      recommendedAction: "Remove or expire the deny override if appropriate.",
      helpDeskHint: "Compare with training policy before removing deny overrides.",
      isRetryable: false,
      shouldEscalate: true,
      relatedDeskOrRole: "sysadmin_desk",
      severity: "critical",
    },
    DENIED_DEPENDENCY_FAILURE: {
      title: "Dependency not satisfied",
      summary: "A prerequisite permission is missing.",
      userMessage: "You need an additional access right before this action can run.",
      adminMessage: dep
        ? `Dependency chain requires ${dep} before ${pk}.`
        : `Dependency failure for ${pk}.`,
      recommendedAction: `Grant ${dep ?? "prerequisite permissions"} or complete the prerequisite flow.`,
      helpDeskHint: "Check permission_dependencies graph in registry export.",
      isRetryable: false,
      shouldEscalate: false,
      relatedDeskOrRole: "sysadmin_desk",
      severity: "warning",
    },
    DENIED_CRITICAL_ACTION_REQUIRES_REASON: {
      title: "Reason required",
      summary: "High-risk actions need a short business justification.",
      userMessage: "Add a reason describing why this action is needed, then retry.",
      adminMessage: `Critical / governed path for ${pk} requires reason text for audit.`,
      recommendedAction: "Collect reason client-side and pass critical.reason to authorization.",
      helpDeskHint: "Reasons are stored on audit trails for PCI/SOX-style review.",
      isRetryable: true,
      shouldEscalate: false,
      relatedDeskOrRole: "help_desk",
      severity: "info",
    },
    DENIED_CRITICAL_ACTION_REQUIRES_STEP_UP: {
      title: "Step-up verification required",
      summary: "This action needs a stronger verification step.",
      userMessage: "Verify with a supervisor or complete step-up authentication to continue.",
      adminMessage: `Step-up policy active for ${pk}.`,
      recommendedAction: "Complete OTP/passcode flow (Pack 5) or supervisor approval path.",
      helpDeskHint: "Check step_up_events for stuck 'required' rows.",
      isRetryable: true,
      shouldEscalate: false,
      relatedDeskOrRole: "sysadmin_desk",
      severity: "warning",
    },
    DENIED_NO_ACTIVE_ROLE: {
      title: "No active role",
      summary: "Assign a primary role before using governed features.",
      userMessage: "Your workspace membership has no active role.",
      adminMessage: "user_roles empty/inactive for tenant.",
      recommendedAction: "Assign a role in Security console.",
      helpDeskHint: "Verify tenant_members.active and user_roles.is_active.",
      isRetryable: false,
      shouldEscalate: true,
      relatedDeskOrRole: "sysadmin_desk",
      severity: "critical",
    },
  };

  const base = table[input.reasonCode] ?? {
    title: "Action blocked",
    summary: input.policyHint ?? "Authorization denied.",
    userMessage: "You cannot complete this action right now.",
    adminMessage: `Denied: ${input.reasonCode} for ${pk}.`,
    recommendedAction: "Review permissions, scope, and policy gates.",
    helpDeskHint: input.policyHint ?? "Open Security console audit and execution policies.",
    isRetryable: false,
    shouldEscalate: false,
    relatedDeskOrRole: "help_desk",
    severity: "warning" as const,
  };

  return {
    ...base,
    technicalReasonCode: input.reasonCode,
    userMessage: input.policyHint ? `${base.userMessage} (${input.policyHint})` : base.userMessage,
  };
}
