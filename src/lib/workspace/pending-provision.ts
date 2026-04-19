export const PENDING_WORKSPACE_PROVISION_KEY = "seigen_pending_workspace_provision_v1";

export type PendingWorkspaceProvision = {
  businessName: string;
  contactName: string;
  phone: string;
  planId: string;
};
