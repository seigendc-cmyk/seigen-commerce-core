import { browserLocalJson } from "@/modules/inventory/services/storage";

const NS = { namespace: "seigen.consignment", version: 1 as const };

export const CONSIGNMENT_APPROVAL_QUEUE_UPDATED = "seigen-consignment-approval-queue-updated";

export type ConsignmentAgreementApprovalStatus = "pending" | "approved" | "rejected";

export type ConsignmentAgreementApprovalRequest = {
  id: string;
  status: ConsignmentAgreementApprovalStatus;
  documentId: string;

  principalBranchId: string;
  agentName: string;
  agentEmail: string;
  premiumPercent: number;

  submittedByLabel: string;
  createdAt: string;
  resolvedAt?: string;
  resolvedByLabel?: string;
  resolutionReason?: string;

  /** Populated on approval */
  agreementId?: string;
  stallBranchId?: string;
  agentUserId?: string;
};

type Db = { requests: ConsignmentAgreementApprovalRequest[] };

function uid(): string {
  return `caa_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function getDb(): Db {
  const store = browserLocalJson(NS);
  if (!store) return { requests: [] };
  return store.read<Db>("consignment_approval_queue", { requests: [] });
}

function setDb(db: Db) {
  const store = browserLocalJson(NS);
  if (!store) return;
  store.write("consignment_approval_queue", db);
}

function notifyQueue() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CONSIGNMENT_APPROVAL_QUEUE_UPDATED));
  window.dispatchEvent(new Event("seigen-consignment-updated"));
}

export function listConsignmentAgreementApprovalRequests(limit = 200): ConsignmentAgreementApprovalRequest[] {
  return getDb()
    .requests.slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export function listPendingConsignmentAgreementApprovals(): ConsignmentAgreementApprovalRequest[] {
  return getDb()
    .requests.filter((r) => r.status === "pending")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function submitConsignmentAgreementForApproval(input: {
  documentId: string;
  principalBranchId: string;
  agentName: string;
  agentEmail: string;
  premiumPercent: number;
  submittedByLabel: string;
}): ConsignmentAgreementApprovalRequest {
  const db = getDb();
  // Replace any older pending request for same agent+principal (prevents queue spam).
  db.requests = db.requests.filter(
    (r) =>
      !(
        r.status === "pending" &&
        r.principalBranchId === input.principalBranchId &&
        r.agentEmail.trim().toLowerCase() === input.agentEmail.trim().toLowerCase()
      ),
  );

  const row: ConsignmentAgreementApprovalRequest = {
    id: uid(),
    status: "pending",
    documentId: input.documentId,
    principalBranchId: input.principalBranchId,
    agentName: input.agentName.trim() || "Agent",
    agentEmail: input.agentEmail.trim().toLowerCase(),
    premiumPercent: Math.max(0, Math.round((Number(input.premiumPercent) || 0) * 100) / 100),
    submittedByLabel: input.submittedByLabel.trim() || "Staff",
    createdAt: new Date().toISOString(),
  };
  db.requests.push(row);
  setDb(db);
  notifyQueue();
  return row;
}

/**
 * Desk-enabled wrapper (keeps legacy queue intact).
 * Creates a Desk ApprovalRequest so the item appears on role desks.
 */
export function submitConsignmentAgreementForApprovalViaDesk(input: {
  documentId: string;
  principalBranchId: string;
  agentName: string;
  agentEmail: string;
  premiumPercent: number;
  submittedByLabel: string;
  initiatedByStaffId: string;
}) {
  const row = submitConsignmentAgreementForApproval(input);
  // Lazy import to avoid circular deps risk across modules.
  const { submitApprovalRequest } = require("@/modules/desk/services/approval-engine") as typeof import("@/modules/desk/services/approval-engine");
  submitApprovalRequest({
    tenantId: null,
    branchId: row.principalBranchId,
    moduleKey: "consignment",
    actionKey: "consignment.agreement_approval",
    entityType: "consignment_agreement_request",
    entityId: row.id,
    title: `Consignment agreement approval — ${row.agentName}`,
    summary: `Agent: ${row.agentEmail} · Premium: ${row.premiumPercent.toFixed(2)}% · Document: ${row.documentId}`,
    reason: "Consignment agreements require approval before provisioning an Agent Stall.",
    priority: "high",
    initiatedByStaffId: input.initiatedByStaffId,
    initiatedByLabel: input.submittedByLabel,
    executionMode: "approve_only",
    payloadBefore: null,
    payloadAfter: { documentId: row.documentId, premiumPercent: row.premiumPercent },
    metadata: { agentEmail: row.agentEmail, agentName: row.agentName, principalBranchId: row.principalBranchId },
  });
  return row;
}

export function markConsignmentAgreementApproved(
  id: string,
  patch: Pick<ConsignmentAgreementApprovalRequest, "agreementId" | "stallBranchId" | "agentUserId">,
  resolvedByLabel: string,
): { ok: true; request: ConsignmentAgreementApprovalRequest } | { ok: false; error: string } {
  const db = getDb();
  const r = db.requests.find((x) => x.id === id);
  if (!r) return { ok: false, error: "Request not found." };
  if (r.status !== "pending") return { ok: false, error: "Request is not pending." };
  r.status = "approved";
  r.resolvedAt = new Date().toISOString();
  r.resolvedByLabel = resolvedByLabel.trim() || "Approver";
  r.agreementId = patch.agreementId;
  r.stallBranchId = patch.stallBranchId;
  r.agentUserId = patch.agentUserId;
  setDb(db);
  notifyQueue();
  return { ok: true, request: r };
}

export function rejectConsignmentAgreementApproval(
  id: string,
  resolvedByLabel: string,
  reason: string,
): { ok: true; request: ConsignmentAgreementApprovalRequest } | { ok: false; error: string } {
  const db = getDb();
  const r = db.requests.find((x) => x.id === id);
  if (!r) return { ok: false, error: "Request not found." };
  if (r.status !== "pending") return { ok: false, error: "Request is not pending." };
  r.status = "rejected";
  r.resolvedAt = new Date().toISOString();
  r.resolvedByLabel = resolvedByLabel.trim() || "Approver";
  r.resolutionReason = reason.trim() || "Rejected.";
  setDb(db);
  notifyQueue();
  return { ok: true, request: r };
}

