import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";
import { authorizeForCurrentUser } from "@/modules/authz/authorization-guard";
import { loadPermissionMetaByKeys } from "@/modules/authz/permission-registry";
import { logGovernanceEvent } from "@/modules/authz/audit-log.service";
import { createNotification } from "@/modules/desk/services/notification-service";
import { getApprovalPolicy } from "./approval-policy-registry";
import { computeDueAt, computeExpiresAt, resolveStageAssignee } from "./approval-routing.service";
import * as repo from "./approval-repo";
import type { ApprovalPolicyDefinition, ApprovalRequestRow, ApprovalStageRow, ExecutionJobRow } from "./types";

function nowIso() {
  return new Date().toISOString();
}

function requiredApprovalPermission(risk: string): string {
  return risk === "critical" || risk === "high" ? "approval.request.approve_high" : "approval.request.approve_low";
}

export async function createApprovalRequestFromSensitiveAction(input: {
  approvalPolicyCode: string;
  permissionKey: string;
  actionCode: string;
  moduleCode: string;
  entityType: string;
  entityId: string | null;
  branchId?: string | null;
  warehouseId?: string | null;
  terminalId?: string | null;
  reason?: string | null;
  payloadJson?: Record<string, unknown>;
}): Promise<{ ok: true; request: ApprovalRequestRow; stages: ApprovalStageRow[]; job: ExecutionJobRow } | { ok: false; error: string }> {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false, error: "Not signed in / no workspace" };

  const policy = getApprovalPolicy(input.approvalPolicyCode);
  if (!policy) return { ok: false, error: `Unknown approval policy: ${input.approvalPolicyCode}` };

  // Permission must already be checked by governed action; still record audit.
  const metaMap = await loadPermissionMetaByKeys([input.permissionKey]);
  const riskLevel = (metaMap[input.permissionKey]?.riskLevel ?? policy.riskLevel) as any;

  const expiresAt = computeExpiresAt(policy);
  const dueAt = policy.slaTargetMinutes ? new Date(Date.now() + policy.slaTargetMinutes * 60_000).toISOString() : null;

  const created = await repo.insertApprovalRequest({
    tenantId: ws.tenant.id,
    approvalPolicyCode: policy.policyCode,
    permissionKey: input.permissionKey,
    actionCode: input.actionCode,
    moduleCode: input.moduleCode,
    entityType: input.entityType,
    entityId: input.entityId,
    requestingUserId: user.id,
    requestingRoleCode: null,
    branchId: input.branchId ?? null,
    warehouseId: input.warehouseId ?? null,
    terminalId: input.terminalId ?? null,
    reason: input.reason ?? null,
    payloadJson: input.payloadJson ?? {},
    status: "pending",
    riskLevel,
    dueAt,
    expiresAt,
  });
  if (!created.ok) return created;

  const req = created.request;
  const stageRows: Array<Omit<ApprovalStageRow, "id" | "createdAt">> = policy.stages.map((s) => {
    const assignee = resolveStageAssignee(s, { tenantId: req.tenantId, branchId: req.branchId, warehouseId: req.warehouseId, terminalId: req.terminalId, requestingUserId: req.requestingUserId, requestingRoleCode: req.requestingRoleCode });
    return {
      approvalRequestId: req.id,
      stageOrder: s.stageOrder,
      stageCode: s.stageCode,
      approverType: s.approverType,
      approverRoleCode: assignee.approverRoleCode,
      approverUserId: assignee.approverUserId,
      approverScopeJson: assignee.approverScopeJson,
      requiredApprovalsCount: s.requiredApprovalsCount,
      status: s.stageOrder === 1 ? "pending" : "skipped",
      dueAt: s.stageOrder === 1 ? computeDueAt(s) : null,
      completedAt: null,
      createdAt: "",
      id: "",
    } as any;
  });

  const stagesIns = await repo.insertStages(stageRows);
  if (!stagesIns.ok) return { ok: false, error: stagesIns.error };

  // Create idempotent execution job (ready only after approval)
  const jobUp = await repo.upsertExecutionJob({
    approvalRequestId: req.id,
    executionKey: `exec:${req.permissionKey}:${req.actionCode}:${req.entityType}:${req.entityId ?? "none"}`,
    status: "pending",
    handlerCode: policy.executionHandlerCode,
    payloadJson: {
      permissionKey: req.permissionKey,
      actionCode: req.actionCode,
      moduleCode: req.moduleCode,
      entityType: req.entityType,
      entityId: req.entityId,
      branchId: req.branchId,
      requesterUserId: req.requestingUserId,
      reason: req.reason,
      payload: req.payloadJson,
    },
  });
  if (!jobUp.ok) return { ok: false, error: jobUp.error };

  await logGovernanceEvent({
    tenantId: ws.tenant.id,
    actorUserId: user.id,
    entityType: "approval_request",
    entityId: req.id,
    actionCode: "approval.request.created",
    reason: req.reason,
    metadata: { policyCode: policy.policyCode, permissionKey: req.permissionKey, riskLevel: req.riskLevel },
  });

  // In-app notification hook (desk service)
  createNotification({
    moduleKey: "governance",
    entityType: "approval_request",
    entityId: req.id,
    branchId: req.branchId ?? null,
    title: `Approval required: ${req.permissionKey}`,
    message: req.reason ?? "Approval required.",
    severity: req.riskLevel === "critical" ? "critical" : req.riskLevel === "high" ? "urgent" : "warning",
    category: "approval-related",
    intendedRoleIds: [],
    intendedStaffIds: [],
    visibleToSysAdmin: true,
    visibleToBranchManagers: true,
    requiresAcknowledgement: false,
    linkedApprovalId: req.id,
    expiresAt: req.expiresAt,
  });

  return { ok: true, request: req, stages: stagesIns.stages, job: jobUp.job };
}

export async function listMyPendingApprovals(): Promise<{ ok: true; rows: ApprovalRequestRow[] } | { ok: false; error: string }> {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false, error: "Not signed in / no workspace" };

  // Only users with approval permission should see queue.
  const can = await authorizeForCurrentUser({ permissionKey: "approval.history.view" });
  if (!can.allowed) return { ok: false, error: "Not permitted." };

  const rows = await repo.listPendingRequests(ws.tenant.id);
  return { ok: true, rows };
}

export async function actOnApprovalStage(input: { requestId: string; stageId: string; action: "approve" | "reject"; comment?: string }) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };

  const bundle = await repo.getRequestBundle(ws.tenant.id, input.requestId);
  if (!bundle) return { ok: false as const, error: "Request not found." };

  const req = bundle.request;
  const stage = bundle.stages.find((s) => s.id === input.stageId);
  if (!stage) return { ok: false as const, error: "Stage not found." };
  if (req.status !== "pending" && req.status !== "partially_approved" && req.status !== "escalated") return { ok: false as const, error: "Request is not active." };
  if (stage.status !== "pending") return { ok: false as const, error: "Stage is not pending." };

  const requiredPerm = requiredApprovalPermission(req.riskLevel);
  const canApprove = await authorizeForCurrentUser({ permissionKey: requiredPerm });
  if (!canApprove.allowed) return { ok: false as const, error: `Missing permission: ${requiredPerm}` };

  // Self-approval rule (policy defines; we enforce default true for safety)
  if (req.requestingUserId === user.id) {
    return { ok: false as const, error: "Self-approval is blocked for governed actions." };
  }

  // Prevent double approval by same actor in stage
  const existing = bundle.actions.find((a) => a.approvalRequestStageId === stage.id && a.actorUserId === user.id && a.action === "approve");
  if (existing) return { ok: false as const, error: "You already approved this stage." };

  const actionRow = await repo.appendStageAction({
    approvalRequestId: req.id,
    approvalRequestStageId: stage.id,
    actorUserId: user.id,
    action: input.action,
    comment: input.comment ?? null,
    metadata: { requiredPerm },
  });
  if (!actionRow.ok) return actionRow;

  if (input.action === "reject") {
    await repo.updateStage({ stageId: stage.id, patch: { status: "rejected", completedAt: nowIso() } });
    await repo.updateRequest({ tenantId: ws.tenant.id, requestId: req.id, patch: { status: "rejected", rejectedAt: nowIso() } });
    await logGovernanceEvent({ tenantId: ws.tenant.id, actorUserId: user.id, entityType: "approval_request", entityId: req.id, actionCode: "approval.request.rejected", reason: input.comment ?? null, metadata: { stageId: stage.id } });
    return { ok: true as const, status: "rejected" as const };
  }

  // Count approvals in stage and progress
  const approvals = bundle.actions.filter((a) => a.approvalRequestStageId === stage.id && a.action === "approve");
  const nextCount = approvals.length + 1; // include this action (bundle is stale)
  if (nextCount < stage.requiredApprovalsCount) {
    await repo.updateRequest({ tenantId: ws.tenant.id, requestId: req.id, patch: { status: "partially_approved" } });
    return { ok: true as const, status: "partially_approved" as const };
  }

  // Complete this stage
  await repo.updateStage({ stageId: stage.id, patch: { status: "completed", completedAt: nowIso(), dueAt: null } });

  // Find next stage
  const ordered = bundle.stages.slice().sort((a, b) => a.stageOrder - b.stageOrder);
  const idx = ordered.findIndex((s) => s.id === stage.id);
  const next = ordered.slice(idx + 1).find((s) => true);
  if (next) {
    await repo.updateStage({ stageId: next.id, patch: { status: "pending", dueAt: next.dueAt ?? null } });
    await repo.updateRequest({ tenantId: ws.tenant.id, requestId: req.id, patch: { status: "pending" } });
    return { ok: true as const, status: "pending" as const };
  }

  // All stages done
  await repo.updateRequest({ tenantId: ws.tenant.id, requestId: req.id, patch: { status: "approved", approvedAt: nowIso() } });
  // Mark execution job ready
  const job = bundle.jobs[0];
  if (job) await repo.updateExecutionJob({ jobId: job.id, patch: { status: "ready" } });

  await logGovernanceEvent({ tenantId: ws.tenant.id, actorUserId: user.id, entityType: "approval_request", entityId: req.id, actionCode: "approval.request.approved", reason: input.comment ?? null, metadata: { stageId: stage.id } });
  return { ok: true as const, status: "approved" as const };
}

