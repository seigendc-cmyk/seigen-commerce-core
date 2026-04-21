import { browserLocalJson } from "@/modules/inventory/services/storage";

const NS = { namespace: "seigen.consignment", version: 1 as const };

export const CONSIGNMENT_AGENT_PROVISIONING_UPDATED = "seigen-consignment-agent-provisioning-updated";

export type ConsignmentAgentProvisioning = {
  id: string;
  createdAt: string;
  updatedAt: string;
  agreementId: string;
  stallBranchId: string;
  principalBranchId: string;
  agentName: string;
  agentEmail: string;
  /** Set when the agent logs in and claims the provisioned stall. */
  agentUserId: string | null;
  status: "pending_link" | "linked" | "disabled";
  notes: string;
};

type Db = { rows: ConsignmentAgentProvisioning[] };

function uid(): string {
  return `cap_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function nowIso() {
  return new Date().toISOString();
}

function getDb(): Db {
  const store = browserLocalJson(NS);
  if (!store) return { rows: [] };
  return store.read<Db>("agent_provisioning", { rows: [] });
}

function setDb(db: Db) {
  const store = browserLocalJson(NS);
  if (!store) return;
  store.write("agent_provisioning", db);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CONSIGNMENT_AGENT_PROVISIONING_UPDATED));
}

export function listConsignmentAgentProvisioning(limit = 200): ConsignmentAgentProvisioning[] {
  return getDb()
    .rows.slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);
}

export function findProvisioningByAgentEmail(email: string): ConsignmentAgentProvisioning | undefined {
  const e = email.trim().toLowerCase();
  if (!e) return undefined;
  return getDb().rows.find((r) => r.agentEmail === e && r.status !== "disabled");
}

export function findProvisioningByAgentUserId(userId: string): ConsignmentAgentProvisioning | undefined {
  const u = userId.trim();
  if (!u) return undefined;
  return getDb().rows.find((r) => r.agentUserId === u && r.status !== "disabled");
}

export function listProvisioningsByAgentEmail(email: string, limit = 50): ConsignmentAgentProvisioning[] {
  const e = email.trim().toLowerCase();
  if (!e) return [];
  return getDb()
    .rows.filter((r) => r.agentEmail === e && r.status !== "disabled")
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);
}

export function listProvisioningsByAgentUserId(userId: string, limit = 50): ConsignmentAgentProvisioning[] {
  const u = userId.trim();
  if (!u) return [];
  return getDb()
    .rows.filter((r) => r.agentUserId === u && r.status !== "disabled")
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);
}

export function createAgentProvisioning(input: Omit<ConsignmentAgentProvisioning, "id" | "createdAt" | "updatedAt">): ConsignmentAgentProvisioning {
  const db = getDb();
  const ts = nowIso();
  const row: ConsignmentAgentProvisioning = {
    id: uid(),
    createdAt: ts,
    updatedAt: ts,
    ...input,
    agentEmail: input.agentEmail.trim().toLowerCase(),
    notes: input.notes ?? "",
  };
  db.rows.push(row);
  setDb(db);
  return row;
}

export function linkAgentUserToProvisioning(input: {
  provisioningId: string;
  agentUserId: string;
}): { ok: true; row: ConsignmentAgentProvisioning } | { ok: false; error: string } {
  const db = getDb();
  const row = db.rows.find((r) => r.id === input.provisioningId);
  if (!row) return { ok: false, error: "Provisioning record not found." };
  if (row.status === "disabled") return { ok: false, error: "Provisioning is disabled." };
  row.agentUserId = input.agentUserId;
  row.status = "linked";
  row.updatedAt = nowIso();
  setDb(db);
  return { ok: true, row };
}

export function setProvisioningStatus(input: {
  provisioningId: string;
  status: ConsignmentAgentProvisioning["status"];
  notes?: string;
}): { ok: true; row: ConsignmentAgentProvisioning } | { ok: false; error: string } {
  const db = getDb();
  const row = db.rows.find((r) => r.id === input.provisioningId);
  if (!row) return { ok: false, error: "Provisioning record not found." };
  row.status = input.status;
  if (input.notes != null) row.notes = input.notes;
  row.updatedAt = nowIso();
  setDb(db);
  return { ok: true, row };
}

export function disableProvisioning(input: {
  provisioningId: string;
  reason?: string;
}): { ok: true; row: ConsignmentAgentProvisioning } | { ok: false; error: string } {
  const db = getDb();
  const row = db.rows.find((r) => r.id === input.provisioningId);
  if (!row) return { ok: false, error: "Provisioning record not found." };
  row.status = "disabled";
  row.updatedAt = nowIso();
  const reason = input.reason?.trim();
  row.notes = reason ? `${row.notes}\n[disabled] ${reason}`.trim() : `${row.notes}\n[disabled]`.trim();
  setDb(db);
  return { ok: true, row };
}

