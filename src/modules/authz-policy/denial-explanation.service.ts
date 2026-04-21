import type { AuthzReasonCode } from "@/modules/authz/constants";
import type { PermissionCheckResult } from "@/modules/authz/types";
import type { DenialExplanation } from "./types";
import { mapHelpDeskExplanation } from "./helpdesk-explanation.mapper";

export function buildDenialExplanation(input: {
  permissionResult: PermissionCheckResult;
  policyHint?: string | null;
}): DenialExplanation {
  const r = input.permissionResult;
  const code = r.reasonCode as AuthzReasonCode | string;
  return mapHelpDeskExplanation({
    reasonCode: code,
    permissionKey: r.permissionKey,
    scopeMatched: r.scopeMatched,
    dependencyFailures: r.dependencyFailures,
    policyHint: input.policyHint,
  });
}

export function buildPolicyDenialExplanation(input: {
  permissionKey: string;
  technicalReasonCode: string;
  userMessage: string;
  adminMessage: string;
}): DenialExplanation {
  return {
    title: "Action blocked",
    summary: input.userMessage,
    technicalReasonCode: input.technicalReasonCode,
    userMessage: input.userMessage,
    adminMessage: input.adminMessage,
    recommendedAction: "Review execution policy and user role scope.",
    helpDeskHint: `Policy gate: ${input.technicalReasonCode} for ${input.permissionKey}.`,
    isRetryable: true,
    shouldEscalate: false,
    relatedDeskOrRole: "sysadmin_desk",
    severity: "warning",
  };
}
