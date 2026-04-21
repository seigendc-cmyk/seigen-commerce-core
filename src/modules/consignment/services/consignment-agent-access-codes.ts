import { browserLocalJson } from "@/modules/inventory/services/storage";

const NS = { namespace: "seigen.consignment", version: 1 as const };

export const CONSIGNMENT_AGENT_ACCESS_CODES_UPDATED = "seigen-consignment-agent-access-codes-updated";

export type ConsignmentAgentAccessCodeRow = {
  id: string;
  createdAt: string;
  provisioningId: string;
  code: string;
  status: "active" | "redeemed" | "disabled";
  redeemedAt?: string;
  redeemedByUserId?: string;
};

type Db = { rows: ConsignmentAgentAccessCodeRow[] };

function uid(): string {
  return `cac_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replaceAll(/\s+/g, "");
}

function newHumanCode(): string {
  // 10 chars, no ambiguous letters (O/I/0/1)
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let s = "";
  for (let i = 0; i < 10; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

function getDb(): Db {
  const store = browserLocalJson(NS);
  if (!store) return { rows: [] };
  return store.read<Db>("agent_access_codes", { rows: [] });
}

function setDb(db: Db) {
  const store = browserLocalJson(NS);
  if (!store) return;
  store.write("agent_access_codes", db);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CONSIGNMENT_AGENT_ACCESS_CODES_UPDATED));
}

export function getActiveAgentAccessCodeForProvisioning(provisioningId: string): ConsignmentAgentAccessCodeRow | undefined {
  return getDb().rows.find((r) => r.provisioningId === provisioningId && r.status === "active");
}

export function createAgentAccessCodeForProvisioning(provisioningId: string): ConsignmentAgentAccessCodeRow {
  const db = getDb();
  // Disable any old active code
  for (const r of db.rows) {
    if (r.provisioningId === provisioningId && r.status === "active") r.status = "disabled";
  }
  const row: ConsignmentAgentAccessCodeRow = {
    id: uid(),
    createdAt: nowIso(),
    provisioningId,
    code: newHumanCode(),
    status: "active",
  };
  db.rows.push(row);
  setDb(db);
  return row;
}

export function redeemAgentAccessCode(input: {
  code: string;
  provisioningId: string;
  agentUserId: string;
}): { ok: true; accessCodeId: string } | { ok: false; error: string } {
  const db = getDb();
  const code = normalizeCode(input.code);
  const row = db.rows.find((r) => r.code === code);
  if (!row) return { ok: false, error: "Invalid access code." };
  if (row.status !== "active") return { ok: false, error: "This access code is no longer active." };
  if (row.provisioningId !== input.provisioningId) return { ok: false, error: "Access code does not match this stall provisioning." };
  row.status = "redeemed";
  row.redeemedAt = nowIso();
  row.redeemedByUserId = input.agentUserId;
  setDb(db);
  return { ok: true, accessCodeId: row.id };
}

export function disableActiveAgentAccessCodesForProvisioning(provisioningId: string): { disabled: number } {
  const db = getDb();
  let disabled = 0;
  for (const r of db.rows) {
    if (r.provisioningId === provisioningId && r.status === "active") {
      r.status = "disabled";
      disabled++;
    }
  }
  if (disabled > 0) setDb(db);
  return { disabled };
}

