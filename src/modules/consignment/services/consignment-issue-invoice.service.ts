import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";
import type { Id } from "@/modules/inventory/types/models";
import { getConsignmentAgreement } from "@/modules/consignment/services/consignment-agreements";
import { appendConsignmentCustodyEntry } from "@/modules/consignment/services/consignment-custody-ledger";
import { postConsignmentIssueInvoiceJournal } from "@/modules/consignment/services/consignment-issue-accounting";
import { requireStockOpsBranch, requireTradingBranch } from "@/modules/inventory/services/stock-mutation-policy";
import {
  appendAudit,
  documentNumberExists,
  getIssueInvoice,
  listIssueInvoices,
  saveIssueInvoice,
} from "@/modules/consignment/services/consignment-issue-invoice-storage";
import { getConsignmentActorLabel } from "@/modules/consignment/services/consignment-actor";
import type {
  ConsignmentIssueInvoice,
  ConsignmentIssueInvoiceLine,
  ConsignmentIssueInvoiceStatus,
} from "@/modules/consignment/types/consignment-issue-invoice";

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function nowIso(): string {
  return new Date().toISOString();
}

function lineTotal(qty: number, unit: number): number {
  return round2(Math.max(0, qty) * Math.max(0, unit));
}

export function recalculateInvoiceTotals(lines: ConsignmentIssueInvoiceLine[]): number {
  let t = 0;
  for (const l of lines) t += l.lineTotal;
  return round2(t);
}

function nextDocumentNumber(): string {
  const n = Date.now();
  return `CII-${n.toString(36).toUpperCase()}`;
}

export function validateInvoiceLinesForDraft(lines: ConsignmentIssueInvoiceLine[]): { ok: true } | { ok: false; error: string } {
  if (!lines.length) return { ok: false, error: "Add at least one product line." };
  for (const l of lines) {
    if (!Number.isFinite(l.quantity) || l.quantity <= 0) return { ok: false, error: "Line quantities must be positive." };
    if (!Number.isFinite(l.unitIssueValue) || l.unitIssueValue <= 0) return { ok: false, error: "Unit issue value must be positive." };
  }
  return { ok: true };
}

function assertAgreementMatchesInvoice(inv: ConsignmentIssueInvoice) {
  const ag = getConsignmentAgreement(inv.agreementId);
  if (!ag) return { ok: false as const, error: "Agreement not found." };
  if (!ag.isActive) return { ok: false as const, error: "Agreement is inactive." };
  if (ag.principalBranchId !== inv.issuingBranchId) return { ok: false as const, error: "Issuing branch must match the agreement principal branch." };
  if (ag.stallBranchId !== inv.agentStallBranchId) return { ok: false as const, error: "Agent stall must match the agreement." };

  // Branch discipline: principal must be stock-ops (warehouse/trading), stall must be trading; head office blocked.
  const principal = requireStockOpsBranch(ag.principalBranchId, "Principal branch cannot hold consignment stock.");
  if (!principal.ok) return { ok: false as const, error: principal.error };
  const stall = requireTradingBranch(ag.stallBranchId, "Consignment stall must be a trading branch (not head office).");
  if (!stall.ok) return { ok: false as const, error: stall.error };

  return { ok: true as const, agreement: ag };
}

/** Principal stock available for consignment issue (on hand at issuing branch). */
export function principalAvailableQty(issuingBranchId: Id, productId: Id): number {
  return InventoryRepo.getStock(issuingBranchId, productId)?.onHandQty ?? 0;
}

/**
 * Reserve principal stock when moving to pending_approval: reduces warehouse on-hand so units
 * cannot be double-allocated. Agent stall on-hand stays unchanged until approval.
 */
function reservePrincipalStockForPending(inv: ConsignmentIssueInvoice): { ok: true } | { ok: false; error: string } {
  for (const l of inv.lines) {
    const have = principalAvailableQty(inv.issuingBranchId, l.productId);
    if (have + 1e-9 < l.quantity) {
      return { ok: false, error: `Insufficient stock for ${l.sku}: have ${have}, need ${l.quantity}.` };
    }
  }
  for (const l of inv.lines) {
    InventoryRepo.incrementStock(inv.issuingBranchId, l.productId, -l.quantity);
  }
  return { ok: true };
}

function releasePrincipalReservation(inv: ConsignmentIssueInvoice) {
  for (const l of inv.lines) {
    InventoryRepo.incrementStock(inv.issuingBranchId, l.productId, l.quantity);
  }
}

/**
 * After approval: stock was already deducted at principal when pending; add to agent stall sellable inventory.
 */
function transferReservedToStall(inv: ConsignmentIssueInvoice): string[] {
  const custodyIds: string[] = [];
  for (const l of inv.lines) {
    InventoryRepo.incrementStock(inv.agentStallBranchId, l.productId, l.quantity);
    const row = appendConsignmentCustodyEntry({
      agreementId: inv.agreementId,
      stallBranchId: inv.agentStallBranchId,
      principalBranchId: inv.issuingBranchId,
      agentId: inv.agentId,
      agentName: inv.agentName,
      productId: l.productId,
      qtyDelta: l.quantity,
      invoiceUnitCost: l.unitIssueValue,
      kind: "issue_to_agent",
      ref: inv.documentNumber,
      memo: `Consignment issue invoice ${inv.documentNumber}`,
      issueInvoiceId: inv.id,
    });
    custodyIds.push(row.id);
  }
  return custodyIds;
}

export function createDraftInvoice(input: {
  agreementId: string;
  documentNumber?: string;
  invoiceDate?: string;
  lines: ConsignmentIssueInvoiceLine[];
  pricingBasisNote?: string;
  remarks?: string;
  actorLabel?: string;
}): { ok: true; invoice: ConsignmentIssueInvoice } | { ok: false; error: string } {
  const ag = getConsignmentAgreement(input.agreementId);
  if (!ag || !ag.isActive) return { ok: false, error: "Agreement not found or inactive." };

  const doc = (input.documentNumber ?? nextDocumentNumber()).trim();
  if (!doc) return { ok: false, error: "Document number required." };
  if (documentNumberExists(doc)) return { ok: false, error: "Document number already used." };

  const v = validateInvoiceLinesForDraft(input.lines);
  if (!v.ok) return v;

  const principal = InventoryRepo.getBranch(ag.principalBranchId);
  const stall = InventoryRepo.getBranch(ag.stallBranchId);
  const ts = nowIso();
  const actor = input.actorLabel ?? getConsignmentActorLabel();

  const mappedLines: ConsignmentIssueInvoiceLine[] = input.lines.map((l) => ({
    ...l,
    id: l.id || uid("ln"),
    lineTotal: lineTotal(l.quantity, l.unitIssueValue),
  }));

  const inv: ConsignmentIssueInvoice = {
    id: uid("cii"),
    documentNumber: doc,
    invoiceDate: (input.invoiceDate ?? ts).slice(0, 10),
    issuingBranchId: ag.principalBranchId,
    issuingBranchName: principal?.name ?? "Principal",
    agentStallBranchId: ag.stallBranchId,
    agentStallName: stall?.name ?? "Agent stall",
    agentId: ag.agentId,
    agentName: ag.agentName,
    agreementId: ag.id,
    agreementReference: ag.notes?.trim() ? ag.notes.slice(0, 80) : undefined,
    status: "draft",
    lines: mappedLines,
    totalValue: recalculateInvoiceTotals(mappedLines),
    pricingBasisNote: input.pricingBasisNote?.trim() || undefined,
    remarks: input.remarks?.trim() || undefined,
    createdAt: ts,
    createdByLabel: actor,
    updatedAt: ts,
    principalStockReserved: false,
  };

  saveIssueInvoice(inv);
  appendAudit({ invoiceId: inv.id, at: ts, actorLabel: actor, action: "created", detail: `Draft ${inv.documentNumber}` });
  return { ok: true, invoice: inv };
}

export function updateDraftInvoice(
  id: string,
  patch: Partial<{
    documentNumber: string;
    invoiceDate: string;
    lines: ConsignmentIssueInvoiceLine[];
    pricingBasisNote: string;
    remarks: string;
  }>,
  actorLabel?: string,
): { ok: true; invoice: ConsignmentIssueInvoice } | { ok: false; error: string } {
  const inv = getIssueInvoice(id);
  if (!inv) return { ok: false, error: "Invoice not found." };
  if (inv.status !== "draft") return { ok: false, error: "Only draft invoices can be edited." };

  const actor = actorLabel ?? getConsignmentActorLabel();
  const next = { ...inv };
  if (patch.documentNumber != null) {
    const d = patch.documentNumber.trim();
    if (!d) return { ok: false, error: "Document number required." };
    if (documentNumberExists(d, id)) return { ok: false, error: "Document number already used." };
    next.documentNumber = d;
  }
  if (patch.invoiceDate != null) next.invoiceDate = patch.invoiceDate.slice(0, 10);
  if (patch.pricingBasisNote !== undefined) next.pricingBasisNote = patch.pricingBasisNote.trim() || undefined;
  if (patch.remarks !== undefined) next.remarks = patch.remarks.trim() || undefined;
  if (patch.lines) {
    const v = validateInvoiceLinesForDraft(patch.lines);
    if (!v.ok) return v;
    next.lines = patch.lines.map((l) => ({
      ...l,
      id: l.id || uid("ln"),
      lineTotal: lineTotal(l.quantity, l.unitIssueValue),
    }));
    next.totalValue = recalculateInvoiceTotals(next.lines);
  }

  const ag = assertAgreementMatchesInvoice(next);
  if (!ag.ok) return ag;

  next.updatedAt = nowIso();
  next.updatedByLabel = actor;
  saveIssueInvoice(next);
  appendAudit({ invoiceId: next.id, at: next.updatedAt, actorLabel: actor, action: "updated", detail: "Draft saved" });
  return { ok: true, invoice: next };
}

export function submitInvoiceForApproval(
  id: string,
  actorLabel?: string,
): { ok: true; invoice: ConsignmentIssueInvoice } | { ok: false; error: string } {
  const inv = getIssueInvoice(id);
  if (!inv) return { ok: false, error: "Invoice not found." };
  if (inv.status !== "draft") return { ok: false, error: "Only draft invoices can be submitted." };

  const v = validateInvoiceLinesForDraft(inv.lines);
  if (!v.ok) return v;

  const ag = assertAgreementMatchesInvoice(inv);
  if (!ag.ok) return ag;

  const reserve = reservePrincipalStockForPending(inv);
  if (!reserve.ok) return reserve;

  const actor = actorLabel ?? getConsignmentActorLabel();
  const ts = nowIso();
  const next: ConsignmentIssueInvoice = {
    ...inv,
    status: "pending_approval",
    submittedAt: ts,
    submittedByLabel: actor,
    updatedAt: ts,
    updatedByLabel: actor,
    principalStockReserved: true,
  };
  saveIssueInvoice(next);
  appendAudit({
    invoiceId: next.id,
    at: ts,
    actorLabel: actor,
    action: "submitted",
    detail: "Submitted for approval; principal stock reserved",
  });
  return { ok: true, invoice: next };
}

export function approveIssueInvoice(
  id: string,
  actorLabel?: string,
): { ok: true; invoice: ConsignmentIssueInvoice } | { ok: false; error: string } {
  const inv = getIssueInvoice(id);
  if (!inv) return { ok: false, error: "Invoice not found." };
  if (inv.status !== "pending_approval") return { ok: false, error: "Only pending invoices can be approved." };
  if (!inv.principalStockReserved) return { ok: false, error: "Invalid state: principal reservation missing." };

  const ag = assertAgreementMatchesInvoice(inv);
  if (!ag.ok) return ag;

  const actor = actorLabel ?? getConsignmentActorLabel();
  const j = postConsignmentIssueInvoiceJournal({ invoice: inv, preparedByLabel: actor });
  if (!j.ok) {
    return { ok: false, error: j.error };
  }

  const custodyEntryIds = transferReservedToStall(inv);
  const ts = nowIso();
  const next: ConsignmentIssueInvoice = {
    ...inv,
    status: "approved",
    approvedAt: ts,
    approvedByLabel: actor,
    updatedAt: ts,
    updatedByLabel: actor,
    journalBatchId: j.journalBatchId,
    custodyEntryIds,
  };
  saveIssueInvoice(next);
  appendAudit({
    invoiceId: next.id,
    at: ts,
    actorLabel: actor,
    action: "approved",
    detail: "Approved; stock released to agent stall",
    metadata: { journalBatchId: j.journalBatchId, custodyEntryIds },
  });
  appendAudit({
    invoiceId: next.id,
    at: ts,
    actorLabel: actor,
    action: "journal_posted",
    detail: `Journal ${j.journalBatchId}`,
  });
  appendAudit({
    invoiceId: next.id,
    at: ts,
    actorLabel: actor,
    action: "stock_posted",
    detail: "Agent sellable stock increased",
  });
  return { ok: true, invoice: next };
}

export function rejectIssueInvoice(
  id: string,
  reason: string,
  actorLabel?: string,
): { ok: true; invoice: ConsignmentIssueInvoice } | { ok: false; error: string } {
  const inv = getIssueInvoice(id);
  if (!inv) return { ok: false, error: "Invoice not found." };
  if (inv.status !== "pending_approval") return { ok: false, error: "Only pending invoices can be rejected." };

  const actor = actorLabel ?? getConsignmentActorLabel();
  const rs = reason.trim();
  if (rs.length < 3) return { ok: false, error: "Rejection reason is required." };

  if (inv.principalStockReserved) releasePrincipalReservation(inv);

  const ts = nowIso();
  const next: ConsignmentIssueInvoice = {
    ...inv,
    status: "rejected",
    rejectedAt: ts,
    rejectedByLabel: actor,
    rejectionReason: rs,
    updatedAt: ts,
    updatedByLabel: actor,
    principalStockReserved: false,
  };
  saveIssueInvoice(next);
  appendAudit({ invoiceId: next.id, at: ts, actorLabel: actor, action: "rejected", detail: rs });
  return { ok: true, invoice: next };
}

export function cancelIssueInvoice(
  id: string,
  actorLabel?: string,
): { ok: true; invoice: ConsignmentIssueInvoice } | { ok: false; error: string } {
  const inv = getIssueInvoice(id);
  if (!inv) return { ok: false, error: "Invoice not found." };
  if (inv.status === "approved") {
    return { ok: false, error: "Approved invoices cannot be cancelled here — use a controlled reversal." };
  }
  if (inv.status === "cancelled" || inv.status === "rejected") {
    return { ok: false, error: "Invoice is already closed." };
  }

  const actor = actorLabel ?? getConsignmentActorLabel();
  const ts = nowIso();

  if (inv.status === "pending_approval" && inv.principalStockReserved) {
    releasePrincipalReservation(inv);
  }

  const next: ConsignmentIssueInvoice = {
    ...inv,
    status: "cancelled",
    cancelledAt: ts,
    cancelledByLabel: actor,
    updatedAt: ts,
    updatedByLabel: actor,
    principalStockReserved: false,
  };
  saveIssueInvoice(next);
  appendAudit({ invoiceId: next.id, at: ts, actorLabel: actor, action: "cancelled", detail: "Cancelled by operator" });
  return { ok: true, invoice: next };
}

export function listInvoicesByStatus(status: ConsignmentIssueInvoiceStatus | "all" = "all"): ConsignmentIssueInvoice[] {
  const rows = listIssueInvoices();
  if (status === "all") return rows;
  return rows.filter((r) => r.status === status);
}

export { getIssueInvoice, listIssueInvoices };
