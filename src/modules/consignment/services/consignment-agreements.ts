import { browserLocalJson } from "@/modules/inventory/services/storage";
import type { Id } from "@/modules/inventory/types/models";
import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";

const NS = { namespace: "seigen.consignment", version: 1 as const };

export const CONSIGNMENT_UPDATED_EVENT = "seigen-consignment-updated";

export type ConsignmentAgreement = {
  id: string;
  createdAt: string;
  updatedAt: string;
  principalBranchId: Id;
  stallBranchId: Id;
  agentId: string;
  agentName: string;
  /** Premium percent added to invoice-cost-derived base price for POS at the stall. */
  premiumPercent: number;
  isActive: boolean;
  notes: string;
};

type Db = { agreements: ConsignmentAgreement[] };

function uid(): string {
  return `cag_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function getDb(): Db {
  const store = browserLocalJson(NS);
  if (!store) return { agreements: [] };
  return store.read<Db>("agreements", { agreements: [] });
}

function setDb(db: Db) {
  const store = browserLocalJson(NS);
  if (!store) return;
  store.write("agreements", db);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CONSIGNMENT_UPDATED_EVENT));
}

export function listConsignmentAgreements(): ConsignmentAgreement[] {
  return getDb()
    .agreements.slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getConsignmentAgreementByStallBranchId(branchId: Id): ConsignmentAgreement | undefined {
  return getDb().agreements.find((a) => a.stallBranchId === branchId && a.isActive);
}

export function getConsignmentAgreement(id: string): ConsignmentAgreement | undefined {
  return getDb().agreements.find((a) => a.id === id);
}

export function createConsignmentAgreement(input: {
  principalBranchId: Id;
  agentName: string;
  premiumPercent: number;
  notes?: string;
}): ConsignmentAgreement {
  const principal = InventoryRepo.getBranch(input.principalBranchId) ?? InventoryRepo.getDefaultBranch();
  const agentName = input.agentName.trim() || "Agent";
  const stall = InventoryRepo.addBranch({ name: `Stall — ${agentName}`, kind: "trading" });
  const ts = nowIso();
  const row: ConsignmentAgreement = {
    id: uid(),
    createdAt: ts,
    updatedAt: ts,
    principalBranchId: principal.id,
    stallBranchId: stall.id,
    agentId: `agent_${stall.id}`,
    agentName,
    premiumPercent: round2(Math.max(0, Number(input.premiumPercent) || 0)),
    isActive: true,
    notes: input.notes?.trim() || "",
  };
  const db = getDb();
  db.agreements.push(row);
  setDb(db);
  return row;
}

export function updateConsignmentAgreement(id: string, patch: Partial<Pick<ConsignmentAgreement, "premiumPercent" | "isActive" | "notes" | "agentName">>) {
  const db = getDb();
  const idx = db.agreements.findIndex((a) => a.id === id);
  if (idx < 0) return;
  const prev = db.agreements[idx]!;
  const next: ConsignmentAgreement = {
    ...prev,
    agentName: patch.agentName != null ? patch.agentName.trim() || prev.agentName : prev.agentName,
    premiumPercent: patch.premiumPercent != null ? round2(Math.max(0, Number(patch.premiumPercent) || 0)) : prev.premiumPercent,
    isActive: patch.isActive != null ? Boolean(patch.isActive) : prev.isActive,
    notes: patch.notes != null ? patch.notes : prev.notes,
    updatedAt: nowIso(),
  };
  db.agreements[idx] = next;
  setDb(db);
}

