import type { StartWorkflowInput } from "./types";

/**
 * Registry of cross-module workflow templates.
 * Pack 6 keeps this intentionally small and composable.
 */
export const WORKFLOW_CODES = [
  "inventory_finance.stock_variance_post",
  "finance_executive.period_reopen",
  "security_governance.role_assignment",
  "pos_supervisory.sale_void",
  "delivery_claims.dispatch_cancel",
  "consignment_legal_finance.settlement_dispute",
] as const;

export type WorkflowCode = (typeof WORKFLOW_CODES)[number];

export function workflowCodeForPermission(permissionKey: string): WorkflowCode | null {
  if (permissionKey === "inventory.variance.post") return "inventory_finance.stock_variance_post";
  if (permissionKey === "finance.period.reopen") return "finance_executive.period_reopen";
  if (permissionKey === "system.roles.assign" || permissionKey === "system.roles.manage") return "security_governance.role_assignment";
  if (permissionKey === "pos.sale.void") return "pos_supervisory.sale_void";
  if (permissionKey === "delivery.dispatch.cancel") return "delivery_claims.dispatch_cancel";
  if (permissionKey === "consignment.settlement.approve") return "consignment_legal_finance.settlement_dispute";
  return null;
}

export function defaultWorkflowTitle(input: { permissionKey: string; actionCode: string }) {
  return `Governed workflow: ${input.permissionKey}`;
}

export function buildWorkflowSeed(input: Omit<StartWorkflowInput, "workflowCode" | "title" | "originModuleCode"> & { workflowCode: WorkflowCode; title?: string }) {
  return {
    workflowCode: input.workflowCode,
    title: input.title ?? defaultWorkflowTitle({ permissionKey: input.originPermissionKey, actionCode: input.originActionCode }),
    originModuleCode: input.originPermissionKey.split(".")[0] ?? "governance",
    ...input,
  } satisfies StartWorkflowInput;
}

