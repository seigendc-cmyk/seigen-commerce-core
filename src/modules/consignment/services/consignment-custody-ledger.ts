import { browserLocalJson } from "@/modules/inventory/services/storage";
import type { Id } from "@/modules/inventory/types/models";
import { CONSIGNMENT_UPDATED_EVENT } from "@/modules/consignment/services/consignment-agreements";

const NS = { namespace: "seigen.consignment", version: 1 as const };

export type ConsignmentCustodyKind =
  | "issue_to_agent"
  | "return_to_principal"
  | "sale"
  | "damage"
  | "loss"
  | "stock_adjustment";

export type ConsignmentCustodyEntry = {
  id: string;
  createdAt: string;
  agreementId: string;
  stallBranchId: Id;
  principalBranchId: Id;
  agentId: string;
  agentName: string;
  productId: Id;
  qtyDelta: number;
  /** Invoice unit cost basis (principal → agent), used for agent debtor valuation. */
  invoiceUnitCost: number;
  kind: ConsignmentCustodyKind;
  ref?: string;
  memo?: string;
  /** Formal consignment issue invoice that authorised this movement (if any). */
  issueInvoiceId?: string;
};

type Db = { entries: ConsignmentCustodyEntry[] };

function uid(): string {
  return `ccu_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function getDb(): Db {
  const store = browserLocalJson(NS);
  if (!store) return { entries: [] };
  return store.read<Db>("custody", { entries: [] });
}

function setDb(db: Db) {
  const store = browserLocalJson(NS);
  if (!store) return;
  store.write("custody", db);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CONSIGNMENT_UPDATED_EVENT));
}

export function listConsignmentCustodyEntries(agreementId?: string, limit = 500): ConsignmentCustodyEntry[] {
  const rows = getDb().entries.slice();
  const filtered = agreementId ? rows.filter((e) => e.agreementId === agreementId) : rows;
  return filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

export function appendConsignmentCustodyEntry(
  entry: Omit<ConsignmentCustodyEntry, "id" | "createdAt"> & { createdAt?: string; id?: string },
): ConsignmentCustodyEntry {
  const row: ConsignmentCustodyEntry = {
    id: entry.id ?? uid(),
    createdAt: entry.createdAt ?? new Date().toISOString(),
    agreementId: entry.agreementId,
    stallBranchId: entry.stallBranchId,
    principalBranchId: entry.principalBranchId,
    agentId: entry.agentId,
    agentName: entry.agentName,
    productId: entry.productId,
    qtyDelta: round2(entry.qtyDelta),
    invoiceUnitCost: round2(entry.invoiceUnitCost),
    kind: entry.kind,
    ref: entry.ref,
    memo: entry.memo,
    issueInvoiceId: entry.issueInvoiceId,
  };
  const db = getDb();
  db.entries.push(row);
  setDb(db);
  return row;
}

export function latestInvoiceUnitCostForStallProduct(stallBranchId: Id, productId: Id): number | null {
  const rows = getDb().entries
    .filter((e) => e.stallBranchId === stallBranchId && e.productId === productId && e.invoiceUnitCost > 0)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return rows[0]?.invoiceUnitCost ?? null;
}

