/**
 * Consignment issue invoice permissions.
 * UI uses this snapshot to hide/disable actions, but critical enforcement must still happen
 * at the authorization engine boundary for server-backed operations.
 */
export type ConsignmentIssueInvoicePermissionSnapshot = {
  canCreateDraft: boolean;
  canSubmitForApproval: boolean;
  canApproveOrReject: boolean;
  canCancelDraft: boolean;
  canCancelPending: boolean;
};

export const CONSIGNMENT_ISSUE_PERMISSION_KEYS = {
  create: "consignment.issue_invoice.create",
  approve: "consignment.issue_invoice.approve",
} as const;

export async function loadIssueInvoicePermissions(input: {
  scopeEntityId?: string;
}): Promise<ConsignmentIssueInvoicePermissionSnapshot> {
  const { authzCheck } = await import("@/modules/authz/authz-actions");

  const [canCreate, canApprove] = await Promise.all([
    authzCheck(CONSIGNMENT_ISSUE_PERMISSION_KEYS.create, { scopeEntityType: "branch", scopeEntityId: input.scopeEntityId }),
    authzCheck(CONSIGNMENT_ISSUE_PERMISSION_KEYS.approve, { scopeEntityType: "branch", scopeEntityId: input.scopeEntityId }),
  ]);

  return {
    canCreateDraft: canCreate.allowed,
    canSubmitForApproval: canCreate.allowed,
    canApproveOrReject: canApprove.allowed,
    canCancelDraft: canCreate.allowed,
    canCancelPending: canApprove.allowed,
  };
}
