import type { ApprovalDecision, ApprovalRequest, ApprovalRoutePolicy } from "@/modules/desk/types/approval";
import { dispatchDeskApprovalsUpdated } from "@/modules/desk/services/desk-events";
import { readDeskDb, writeDeskDb } from "@/modules/desk/services/desk-storage";
import { appendDeskAuditEvent } from "@/modules/desk/services/desk-audit";
import { createNotification } from "@/modules/desk/services/notification-service";
import { DEFAULT_APPROVAL_POLICIES } from "@/modules/desk/services/default-approval-policies";

type Db = { requests: ApprovalRequest[]; decisions: ApprovalDecision[]; policies: ApprovalRoutePolicy[] };

function uid(p: string): string {
  return `${p}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function getDb(): Db {
  const db = readDeskDb<Db>("desk_approvals", { requests: [], decisions: [], policies: [] });
  if (!db.policies || db.policies.length === 0) {
    db.policies = DEFAULT_APPROVAL_POLICIES;
    writeDeskDb("desk_approvals", db);
  }
  return db;
}

function setDb(db: Db) {
  writeDeskDb("desk_approvals", db);
  dispatchDeskApprovalsUpdated();
}

export function listApprovalPolicies(): ApprovalRoutePolicy[] {
  return getDb().policies.slice();
}

export function upsertApprovalPolicy(p: ApprovalRoutePolicy) {
  const db = getDb();
  const idx = db.policies.findIndex((x) => x.id === p.id);
  if (idx >= 0) db.policies[idx] = p;
  else db.policies.push(p);
  setDb(db);
}

export function resolvePolicyFor(moduleKey: string, actionKey: string): ApprovalRoutePolicy | null {
  const db = getDb();
  const pol = db.policies.find((p) => p.isActive && p.moduleKey === moduleKey && p.actionKey === actionKey);
  if (pol) return pol;
  return {
    id: "pol_fallback_sysadmin",
    moduleKey,
    actionKey,
    name: "Fallback SysAdmin approval",
    description: "No policy configured; requires SysAdmin approval.",
    branchScopeMode: "all",
    steps: [
      {
        stepNumber: 1,
        approverMode: "sysadmin",
        minApprovalsRequired: 1,
        allowReject: true,
        allowReturn: true,
        allowEscalate: true,
      },
    ],
    autoEscalateAfterMinutes: 60 * 24,
    isActive: true,
  };
}

function isOverdue(r: ApprovalRequest, now = nowIso()): boolean {
  return Boolean(r.dueAt && (r.status === "pending" || r.status === "escalated") && r.dueAt < now);
}

export function submitApprovalRequest(
  input: Omit<
    ApprovalRequest,
    | "id"
    | "status"
    | "requestedAt"
    | "linkedNotificationIds"
    | "currentStep"
    | "totalSteps"
    | "escalationLevel"
    | "routePolicyId"
  > & {
    id?: string;
    dueAt?: string | null;
    routePolicyId?: string | null;
  },
): ApprovalRequest {
  const db = getDb();
  const pol = resolvePolicyFor(input.moduleKey, input.actionKey);

  const existing = db.requests.find(
    (r) =>
      r.status === "pending" &&
      r.moduleKey === input.moduleKey &&
      r.actionKey === input.actionKey &&
      r.entityType === input.entityType &&
      r.entityId === input.entityId,
  );
  if (existing) return existing;

  const id = input.id ?? uid("apr");
  const row: ApprovalRequest = {
    id,
    tenantId: input.tenantId ?? null,
    branchId: input.branchId ?? null,
    moduleKey: input.moduleKey,
    actionKey: input.actionKey,
    entityType: input.entityType,
    entityId: input.entityId,
    title: input.title,
    summary: input.summary,
    reason: input.reason,
    status: "pending",
    priority: input.priority,
    initiatedByStaffId: input.initiatedByStaffId,
    initiatedByLabel: input.initiatedByLabel,
    requestedAt: nowIso(),
    dueAt: input.dueAt ?? null,
    resolvedAt: null,
    resolvedByStaffId: null,
    resolvedByLabel: null,
    resolutionNote: null,
    linkedNotificationIds: [],
    currentStep: 1,
    totalSteps: pol?.steps.length ?? 1,
    routePolicyId: input.routePolicyId ?? pol?.id ?? null,
    escalationLevel: 0,
    executionMode: input.executionMode,
    payloadBefore: input.payloadBefore ?? null,
    payloadAfter: input.payloadAfter ?? null,
    attachments: input.attachments ?? [],
    metadata: input.metadata ?? {},
  };

  const sev =
    row.priority === "critical" || row.priority === "urgent"
      ? "critical"
      : row.priority === "high"
        ? "urgent"
        : "warning";
  const ntf = createNotification({
    moduleKey: row.moduleKey,
    entityType: row.entityType,
    entityId: row.entityId,
    branchId: row.branchId ?? null,
    title: `Approval required: ${row.title}`,
    message: row.summary || row.reason || "Approval required.",
    severity: sev,
    category: "approval-related",
    intendedRoleIds: [],
    intendedStaffIds: [],
    visibleToSysAdmin: true,
    visibleToBranchManagers: true,
    requiresAcknowledgement: false,
    linkedApprovalId: row.id,
    expiresAt: row.dueAt ?? null,
  });
  row.linkedNotificationIds = [ntf.id];

  db.requests.push(row);
  setDb(db);
  appendDeskAuditEvent({
    sourceKind: "approval",
    sourceId: row.id,
    action: "approval.submitted",
    actorStaffId: row.initiatedByStaffId,
    actorLabel: row.initiatedByLabel,
    moduleKey: row.moduleKey,
    entityType: row.entityType,
    entityId: row.entityId,
    afterState: { status: row.status, step: row.currentStep, policyId: row.routePolicyId },
    correlationId: row.id,
  });
  return row;
}

export function getApprovalRequestById(requestId: string): ApprovalRequest | null {
  const db = getDb();
  return db.requests.find((r) => r.id === requestId) ?? null;
}

export function listPendingApprovals(limit = 200): ApprovalRequest[] {
  return getDb()
    .requests.filter((r) => r.status === "pending" || r.status === "escalated" || r.status === "partially_approved")
    .slice()
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
    .slice(0, limit);
}

export function listMyRequests(staffId: string, limit = 200): ApprovalRequest[] {
  return getDb()
    .requests.filter((r) => r.initiatedByStaffId === staffId)
    .slice()
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
    .slice(0, limit);
}

export function listEscalations(limit = 200): ApprovalRequest[] {
  const now = nowIso();
  return getDb()
    .requests.filter((r) => (r.status === "escalated" || isOverdue(r, now)) && r.status !== "closed")
    .slice()
    .sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""))
    .slice(0, limit);
}

export function listApprovalAuditTrail(requestId: string, limit = 200): ApprovalDecision[] {
  return getDb()
    .decisions.filter((d) => d.requestId === requestId)
    .slice()
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
    .slice(0, limit);
}

export function listPendingForStaff(input: { staffId: string; isSysAdmin: boolean }, limit = 200): ApprovalRequest[] {
  const pending = listPendingApprovals(limit);
  if (input.isSysAdmin) return pending;
  const db = getDb();
  return pending.filter((r) => {
    const pol = resolvePolicyFor(r.moduleKey, r.actionKey);
    const step = pol?.steps.find((s) => s.stepNumber === r.currentStep);
    if (!step) return false;
    if (step.approverMode !== "staff") return false;
    return Boolean(step.staffIds?.includes(input.staffId));
  });
}

export function listPendingForRole(input: { roleId: string; isSysAdmin: boolean }, limit = 200): ApprovalRequest[] {
  const pending = listPendingApprovals(limit);
  if (input.isSysAdmin) return pending;
  return pending.filter((r) => {
    const pol = resolvePolicyFor(r.moduleKey, r.actionKey);
    const step = pol?.steps.find((s) => s.stepNumber === r.currentStep);
    if (!step) return false;
    if (step.approverMode !== "role") return false;
    return Boolean(step.roleIds?.includes(input.roleId));
  });
}

function addDecision(input: Omit<ApprovalDecision, "id" | "occurredAt"> & { occurredAt?: string }): ApprovalDecision {
  const db = getDb();
  const row: ApprovalDecision = {
    id: uid("dec"),
    occurredAt: input.occurredAt ?? nowIso(),
    ...input,
  };
  db.decisions.push(row);
  setDb(db);
  return row;
}

export function approveRequest(input: { requestId: string; actorStaffId: string | null; actorLabel: string; note?: string }) {
  const db = getDb();
  const r = db.requests.find((x) => x.id === input.requestId);
  if (!r) return { ok: false as const, error: "Request not found." };
  if (r.status !== "pending" && r.status !== "escalated" && r.status !== "partially_approved") {
    return { ok: false as const, error: "Request is not pending." };
  }

  addDecision({
    requestId: r.id,
    stepNumber: r.currentStep,
    actorStaffId: input.actorStaffId,
    actorLabel: input.actorLabel,
    decision: "approved",
    note: input.note,
  });

  if (r.currentStep >= r.totalSteps) {
    r.status = "approved";
    r.resolvedAt = nowIso();
    r.resolvedByStaffId = input.actorStaffId;
    r.resolvedByLabel = input.actorLabel;
    r.resolutionNote = input.note ?? null;
  } else {
    r.currentStep += 1;
    r.status = "partially_approved";
  }
  setDb(db);
  appendDeskAuditEvent({
    sourceKind: "approval",
    sourceId: r.id,
    action: "approval.approved",
    actorStaffId: input.actorStaffId,
    actorLabel: input.actorLabel,
    moduleKey: r.moduleKey,
    entityType: r.entityType,
    entityId: r.entityId,
    afterState: { status: r.status, step: r.currentStep },
    notes: input.note ?? null,
    correlationId: r.id,
  });
  return { ok: true as const, request: r };
}

export function rejectRequest(input: { requestId: string; actorStaffId: string | null; actorLabel: string; note?: string }) {
  const db = getDb();
  const r = db.requests.find((x) => x.id === input.requestId);
  if (!r) return { ok: false as const, error: "Request not found." };
  if (r.status !== "pending" && r.status !== "escalated" && r.status !== "partially_approved") {
    return { ok: false as const, error: "Request is not pending." };
  }
  addDecision({
    requestId: r.id,
    stepNumber: r.currentStep,
    actorStaffId: input.actorStaffId,
    actorLabel: input.actorLabel,
    decision: "rejected",
    note: input.note,
  });
  r.status = "rejected";
  r.resolvedAt = nowIso();
  r.resolvedByStaffId = input.actorStaffId;
  r.resolvedByLabel = input.actorLabel;
  r.resolutionNote = input.note ?? null;
  setDb(db);
  appendDeskAuditEvent({
    sourceKind: "approval",
    sourceId: r.id,
    action: "approval.rejected",
    actorStaffId: input.actorStaffId,
    actorLabel: input.actorLabel,
    moduleKey: r.moduleKey,
    entityType: r.entityType,
    entityId: r.entityId,
    afterState: { status: r.status },
    notes: input.note ?? null,
    correlationId: r.id,
  });
  return { ok: true as const, request: r };
}

export function returnRequest(input: { requestId: string; actorStaffId: string | null; actorLabel: string; note?: string }) {
  const db = getDb();
  const r = db.requests.find((x) => x.id === input.requestId);
  if (!r) return { ok: false as const, error: "Request not found." };
  if (r.status !== "pending" && r.status !== "escalated" && r.status !== "partially_approved") {
    return { ok: false as const, error: "Request is not pending." };
  }
  addDecision({
    requestId: r.id,
    stepNumber: r.currentStep,
    actorStaffId: input.actorStaffId,
    actorLabel: input.actorLabel,
    decision: "returned",
    note: input.note,
  });
  r.status = "returned";
  r.resolvedAt = nowIso();
  r.resolvedByStaffId = input.actorStaffId;
  r.resolvedByLabel = input.actorLabel;
  r.resolutionNote = input.note ?? null;
  setDb(db);
  appendDeskAuditEvent({
    sourceKind: "approval",
    sourceId: r.id,
    action: "approval.returned",
    actorStaffId: input.actorStaffId,
    actorLabel: input.actorLabel,
    moduleKey: r.moduleKey,
    entityType: r.entityType,
    entityId: r.entityId,
    afterState: { status: r.status },
    notes: input.note ?? null,
    correlationId: r.id,
  });
  return { ok: true as const, request: r };
}

export function escalateRequest(input: { requestId: string; actorStaffId: string | null; actorLabel: string; note?: string }) {
  const db = getDb();
  const r = db.requests.find((x) => x.id === input.requestId);
  if (!r) return { ok: false as const, error: "Request not found." };
  if (r.status !== "pending" && r.status !== "partially_approved") return { ok: false as const, error: "Request is not pending." };
  addDecision({
    requestId: r.id,
    stepNumber: r.currentStep,
    actorStaffId: input.actorStaffId,
    actorLabel: input.actorLabel,
    decision: "escalated",
    note: input.note,
  });
  r.status = "escalated";
  r.escalationLevel += 1;
  setDb(db);
  appendDeskAuditEvent({
    sourceKind: "approval",
    sourceId: r.id,
    action: "approval.escalated",
    actorStaffId: input.actorStaffId,
    actorLabel: input.actorLabel,
    moduleKey: r.moduleKey,
    entityType: r.entityType,
    entityId: r.entityId,
    afterState: { status: r.status, escalationLevel: r.escalationLevel },
    notes: input.note ?? null,
    correlationId: r.id,
  });
  return { ok: true as const, request: r };
}

export function executeApprovedRequest(input: { requestId: string; actorStaffId: string | null; actorLabel: string; note?: string }) {
  const db = getDb();
  const r = db.requests.find((x) => x.id === input.requestId);
  if (!r) return { ok: false as const, error: "Request not found." };
  if (r.status !== "approved") return { ok: false as const, error: "Request is not approved." };
  r.status = "executed";
  r.resolvedAt = nowIso();
  r.resolvedByStaffId = input.actorStaffId;
  r.resolvedByLabel = input.actorLabel;
  r.resolutionNote = input.note ?? null;
  setDb(db);
  appendDeskAuditEvent({
    sourceKind: "approval",
    sourceId: r.id,
    action: "approval.executed",
    actorStaffId: input.actorStaffId,
    actorLabel: input.actorLabel,
    moduleKey: r.moduleKey,
    entityType: r.entityType,
    entityId: r.entityId,
    afterState: { status: r.status },
    notes: input.note ?? null,
    correlationId: r.id,
  });
  return { ok: true as const, request: r };
}

