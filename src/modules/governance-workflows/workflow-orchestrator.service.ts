import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";
import { evaluateSensitiveAction } from "@/modules/authz-policy/sensitive-action.service";
import { createApprovalRequestFromSensitiveAction } from "@/modules/governance-approvals/approval-request.service";
import { computeWorkflowImpact } from "./workflow-impact.service";
import { resolveVisibility } from "./trust-visibility.service";
import { buildWorkflowSeed, workflowCodeForPermission } from "./workflow-registry";
import { createWorkflow, insertTimelineEvent, insertWorkflowLink, insertWorkflowSteps } from "./workflow-instance.service";
import type { StartWorkflowInput } from "./types";

/**
 * Entry-point orchestrator: starts a workflow for a governed sensitive action.
 * This is *above* module business logic and *below* policy enforcement.
 */
export async function startWorkflowFromSensitiveAction(input: {
  permissionKey: string;
  actionCode: string;
  entityType: string;
  entityId?: string | null;
  moduleCode?: string;
  reason?: string | null;
  policyContext?: Record<string, unknown>;
  branchId?: string | null;
  warehouseId?: string | null;
  terminalId?: string | null;
}): Promise<{ ok: true; workflowId: string; approvalRequestId?: string | null } | { ok: false; error: string }> {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false, error: "Not signed in / no workspace" };

  // Evaluate governed action (Pack 4/5 engine)
  const evalRes = await evaluateSensitiveAction({
    tenantId: ws.tenant.id,
    userId: user.id,
    permissionKey: input.permissionKey,
    actionCode: input.actionCode,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    module: input.moduleCode,
    branchId: input.branchId ?? null,
    reason: input.reason ?? null,
    policyContext: input.policyContext ?? {},
  } as any);

  if (evalRes.outcome === "denied") {
    return { ok: false, error: evalRes.denialExplanation?.userMessage ?? "Denied" };
  }

  const code = workflowCodeForPermission(input.permissionKey) ?? "security_governance.role_assignment";
  const impact = computeWorkflowImpact({
    permissionKey: input.permissionKey,
    riskLevel: (evalRes.permissionResult?.riskLevel ?? "high") as any,
    amount: (input.policyContext as any)?.amount,
    variance: (input.policyContext as any)?.variance,
  });
  const vis = resolveVisibility({ permissionKey: input.permissionKey, riskLevel: (evalRes.permissionResult?.riskLevel ?? "high") as any, impact });

  const seed: StartWorkflowInput = buildWorkflowSeed({
    workflowCode: code,
    title: `Workflow: ${input.permissionKey}`,
    description: input.reason ?? null,
    originPermissionKey: input.permissionKey,
    originActionCode: input.actionCode,
    originEntityType: input.entityType,
    originEntityId: input.entityId ?? null,
    riskLevel: (evalRes.permissionResult?.riskLevel ?? "high") as any,
    branchId: input.branchId ?? null,
    warehouseId: input.warehouseId ?? null,
    terminalId: input.terminalId ?? null,
    payloadJson: { policyContext: input.policyContext ?? {}, sensitiveOutcome: evalRes.outcome },
    impactSummaryJson: impact,
    executiveVisible: vis.executiveVisible,
    trustVisible: vis.trustVisible,
  });

  const wf = await createWorkflow({
    tenantId: ws.tenant.id,
    workflowCode: seed.workflowCode,
    title: seed.title,
    description: seed.description ?? null,
    originModuleCode: seed.originModuleCode,
    originPermissionKey: seed.originPermissionKey,
    originActionCode: seed.originActionCode,
    originEntityType: seed.originEntityType,
    originEntityId: seed.originEntityId ?? null,
    requestingUserId: user.id,
    branchId: seed.branchId ?? null,
    warehouseId: seed.warehouseId ?? null,
    terminalId: seed.terminalId ?? null,
    status: evalRes.outcome === "pending_approval" ? "in_review" : "pending",
    riskLevel: seed.riskLevel,
    executiveVisible: seed.executiveVisible ?? false,
    trustVisible: seed.trustVisible ?? false,
    impactSummaryJson: seed.impactSummaryJson ?? {},
    payloadJson: seed.payloadJson ?? {},
  });
  if (!wf.ok) return { ok: false, error: wf.error };

  await insertTimelineEvent({
    workflowId: wf.workflow.id,
    eventCode: "workflow.started",
    title: "Workflow started",
    summary: `Sensitive action evaluated: ${evalRes.outcome}`,
    actorUserId: user.id,
    metadata: { permissionKey: input.permissionKey, actionCode: input.actionCode },
  });

  // Logical steps: approval + execution (cross-module fabric)
  await insertWorkflowSteps([
    {
      governanceWorkflowId: wf.workflow.id,
      stepOrder: 1,
      stepCode: "approval",
      stepType: "approval",
      moduleCode: input.moduleCode ?? seed.originModuleCode,
      status: evalRes.outcome === "pending_approval" ? "pending" : "skipped",
      assignedToUserId: null,
      assignedToRoleCode: null,
      assignedScopeJson: input.branchId ? { scope: "branch", branchId: input.branchId } : { scope: "tenant" },
      dependsOnStepId: null,
      payloadJson: { approvalPolicyCode: evalRes.codes.policyApprovalCode ?? null },
      startedAt: null,
      completedAt: null,
      createdAt: "",
      id: "",
    } as any,
    {
      governanceWorkflowId: wf.workflow.id,
      stepOrder: 2,
      stepCode: "execution",
      stepType: "execution",
      moduleCode: input.moduleCode ?? seed.originModuleCode,
      status: evalRes.outcome === "allowed_execute_now" ? "pending" : "blocked",
      assignedToUserId: null,
      assignedToRoleCode: null,
      assignedScopeJson: null,
      dependsOnStepId: null,
      payloadJson: {},
      startedAt: null,
      completedAt: null,
      createdAt: "",
      id: "",
    } as any,
  ]);

  // If approval is required, create persistent approval request (Pack 5)
  let approvalRequestId: string | null = null;
  if (evalRes.outcome === "pending_approval") {
    const appr = await createApprovalRequestFromSensitiveAction({
      approvalPolicyCode: String(evalRes.codes.policyApprovalCode ?? "role_assignment_security_review"),
      permissionKey: input.permissionKey,
      actionCode: input.actionCode,
      moduleCode: input.moduleCode ?? seed.originModuleCode,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      branchId: input.branchId ?? null,
      reason: input.reason ?? null,
      payloadJson: { workflowId: wf.workflow.id, ...((input.policyContext as any) ?? {}) },
    });
    if (!appr.ok) return { ok: false, error: appr.error };
    approvalRequestId = appr.request.id;
    await insertWorkflowLink({ workflowId: wf.workflow.id, linkType: "approval_request", linkedId: approvalRequestId, linkedCode: appr.request.approvalPolicyCode });
    await insertWorkflowLink({ workflowId: wf.workflow.id, linkType: "execution_job", linkedId: appr.job.id, linkedCode: appr.job.handlerCode });
    await insertTimelineEvent({ workflowId: wf.workflow.id, eventCode: "approval.created", title: "Approval created", summary: `Approval request ${approvalRequestId} created`, actorUserId: user.id });
  }

  return { ok: true, workflowId: wf.workflow.id, approvalRequestId };
}

