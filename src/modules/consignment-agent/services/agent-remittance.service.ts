import type { Id } from "@/modules/inventory/types/models";
import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";
import { appendJournalBatchRecordOnly, COA_CASH_CODE } from "@/modules/financial/services/general-journal-ledger";
import { createNotification } from "@/modules/desk/services/notification-service";
import { listRemittances, listSales, listShifts, pushAgentNotification, upsertRemittance } from "./agent-storage";
import type { AgentCashRemittance, AgentCashRemittanceStatus } from "../types/agent";

export const COA_AGENT_REMITTANCE_CLEARING_CODE = "2055";

function uid(p: string): string {
  return `${p}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}
function nowIso(): string {
  return new Date().toISOString();
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function nextRemittanceNumber(): string {
  const y = new Date().getFullYear();
  const count = listRemittances().filter((r) => r.remittanceNumber.startsWith(`AR-${y}-`)).length + 1;
  return `AR-${y}-${String(count).padStart(5, "0")}`;
}

function assertStatus(row: AgentCashRemittance, allowed: AgentCashRemittanceStatus[], action: string) {
  if (!allowed.includes(row.status)) {
    return { ok: false as const, error: `Cannot ${action} from status ${row.status}.` };
  }
  return { ok: true as const };
}

export function createDraftRemittance(input: {
  stallBranchId: Id;
  agentId: string;
  agentName: string;
  actorLabel: string;
  shiftId?: string | null;
}): { ok: true; remittance: AgentCashRemittance } | { ok: false; error: string } {
  const branch = InventoryRepo.getBranch(input.stallBranchId);
  if (!branch) return { ok: false, error: "Stall branch not found." };
  if (input.shiftId) {
    const sh = listShifts().find((s) => s.id === input.shiftId);
    if (!sh || sh.status !== "open") return { ok: false, error: "Shift is not open." };
  }

  const row: AgentCashRemittance = {
    id: uid("arem"),
    remittanceNumber: nextRemittanceNumber(),
    createdAt: nowIso(),
    createdByLabel: input.actorLabel,
    stallBranchId: input.stallBranchId,
    stallName: branch.name,
    agentId: input.agentId,
    agentName: input.agentName,
    shiftId: input.shiftId ?? null,
    amountDeclared: 0,
    paymentChannel: "cash_deposit",
    destinationLabel: "Vendor cashbook",
    popReference: "",
    status: "draft",
  };
  upsertRemittance(row);
  return { ok: true, remittance: row };
}

export function updateDraftRemittance(input: {
  remittanceId: string;
  actorLabel: string;
  patch: Partial<
    Pick<
      AgentCashRemittance,
      "amountDeclared" | "paymentChannel" | "destinationLabel" | "popReference" | "popImageDataUrl" | "notes" | "shiftId"
    >
  >;
}): { ok: true; remittance: AgentCashRemittance } | { ok: false; error: string } {
  const row = listRemittances().find((r) => r.id === input.remittanceId);
  if (!row) return { ok: false, error: "Remittance not found." };
  const st = assertStatus(row, ["draft"], "update draft");
  if (!st.ok) return st;

  const next: AgentCashRemittance = {
    ...row,
    ...input.patch,
    amountDeclared:
      input.patch.amountDeclared != null ? round2(Math.max(0, Number(input.patch.amountDeclared))) : row.amountDeclared,
    destinationLabel: input.patch.destinationLabel?.trim() ?? row.destinationLabel,
    popReference: input.patch.popReference?.trim() ?? row.popReference,
    notes: input.patch.notes?.trim() || row.notes,
  };
  upsertRemittance(next);
  return { ok: true, remittance: next };
}

export function submitRemittance(input: { remittanceId: string; actorLabel: string }): { ok: true; remittance: AgentCashRemittance } | { ok: false; error: string } {
  const row = listRemittances().find((r) => r.id === input.remittanceId);
  if (!row) return { ok: false, error: "Remittance not found." };
  const st = assertStatus(row, ["draft"], "submit");
  if (!st.ok) return st;
  if (!(row.amountDeclared > 0)) return { ok: false, error: "Amount must be greater than zero." };
  if (!row.popReference?.trim() && !row.popImageDataUrl?.trim()) return { ok: false, error: "Proof of payment is required." };

  const next: AgentCashRemittance = { ...row, status: "pending_pop_review", submittedAt: nowIso() };
  upsertRemittance(next);

  // Vendor desk notification hook
  createNotification({
    moduleKey: "consignment",
    title: `POP review required: ${next.remittanceNumber}`,
    message: `${next.stallName} · ${next.agentName} · Declared ${next.amountDeclared.toFixed(2)}`,
    severity: "urgent",
    entityType: "agent_cash_remittance",
    entityId: next.id,
    branchId: next.stallBranchId,
    visibleToBranchManagers: true,
    visibleToSysAdmin: true,
    requiresAcknowledgement: true,
    metadata: { remittanceId: next.id, remittanceNumber: next.remittanceNumber, amount: next.amountDeclared },
  });

  pushAgentNotification({
    severity: "info",
    title: "Remittance submitted",
    message: "Awaiting vendor POP review and receipt confirmation.",
    metadata: { remittanceId: next.id, remittanceNumber: next.remittanceNumber },
  });

  return { ok: true, remittance: next };
}

export function rejectPop(input: { remittanceId: string; actorLabel: string; rejectionReason: string }): { ok: true; remittance: AgentCashRemittance } | { ok: false; error: string } {
  const row = listRemittances().find((r) => r.id === input.remittanceId);
  if (!row) return { ok: false, error: "Remittance not found." };
  const st = assertStatus(row, ["pending_pop_review"], "reject POP");
  if (!st.ok) return st;
  const reason = input.rejectionReason?.trim();
  if (!reason) return { ok: false, error: "Rejection reason is required." };

  const next: AgentCashRemittance = {
    ...row,
    status: "pop_rejected",
    rejectedAt: nowIso(),
    rejectedByLabel: input.actorLabel,
    rejectionReason: reason,
  };
  upsertRemittance(next);

  pushAgentNotification({
    severity: "warning",
    title: "POP rejected",
    message: `Vendor rejected POP for ${next.remittanceNumber}. Reason: ${reason}`,
    action: { label: "Review remittance", href: "/dashboard/agent/remittances" },
    metadata: { remittanceId: next.id },
  });

  return { ok: true, remittance: next };
}

export function acceptPopAndApproveReceipt(input: {
  remittanceId: string;
  actorLabel: string;
  receivingAccount: "cashbook" | "bank" | "mobile_money";
  receivingAccountLabel?: string;
}): { ok: true; remittance: AgentCashRemittance } | { ok: false; error: string } {
  const row = listRemittances().find((r) => r.id === input.remittanceId);
  if (!row) return { ok: false, error: "Remittance not found." };
  const st = assertStatus(row, ["pending_pop_review"], "approve receipt");
  if (!st.ok) return st;
  if (row.journalBatchId) return { ok: false, error: "Accounting already posted for this remittance." };

  const debitCode = COA_CASH_CODE;
  const debitName =
    input.receivingAccount === "bank"
      ? input.receivingAccountLabel?.trim() || "Bank"
      : input.receivingAccount === "mobile_money"
        ? input.receivingAccountLabel?.trim() || "Mobile Money Clearing"
        : input.receivingAccountLabel?.trim() || "Cashbook";

  const memo = `Agent remittance received: ${row.remittanceNumber} (${row.stallName})`;
  const jr = appendJournalBatchRecordOnly({
    memo,
    source: "journal",
    documentNumber: row.remittanceNumber,
    preparedBy: input.actorLabel,
    lines: [
      { accountCode: debitCode, accountName: debitName, debit: row.amountDeclared, credit: 0 },
      {
        accountCode: COA_AGENT_REMITTANCE_CLEARING_CODE,
        accountName: "Agent remittance clearing",
        debit: 0,
        credit: row.amountDeclared,
      },
    ],
  });
  if (!jr.ok) return { ok: false, error: jr.error };

  const next: AgentCashRemittance = {
    ...row,
    status: "received_approved",
    approvedAt: nowIso(),
    approvedByLabel: input.actorLabel,
    journalBatchId: jr.batch.id,
  };
  upsertRemittance(next);

  // Notify agent to acknowledge
  pushAgentNotification({
    severity: "info",
    title: "Vendor received your remittance",
    message: `${next.amountDeclared.toFixed(2)} received for ${next.remittanceNumber}. Please confirm acknowledgement.`,
    action: { label: "Confirm payment", href: "/dashboard/agent/remittances" },
    metadata: { remittanceId: next.id, journalBatchId: next.journalBatchId },
  });

  return { ok: true, remittance: next };
}

export function agentConfirmReceipt(input: { remittanceId: string; actorLabel: string; note?: string }): { ok: true; remittance: AgentCashRemittance } | { ok: false; error: string } {
  const row = listRemittances().find((r) => r.id === input.remittanceId);
  if (!row) return { ok: false, error: "Remittance not found." };
  const st = assertStatus(row, ["received_approved"], "confirm receipt");
  if (!st.ok) return st;

  const next: AgentCashRemittance = {
    ...row,
    status: "agent_confirmed",
    agentConfirmedAt: nowIso(),
    notes: input.note?.trim() ? `${row.notes ? `${row.notes}\n` : ""}Agent ack: ${input.note.trim()}` : row.notes,
  };
  upsertRemittance(next);

  // Vendor desk FYI
  createNotification({
    moduleKey: "consignment",
    title: `Agent confirmed receipt: ${next.remittanceNumber}`,
    message: `${next.agentName} acknowledged vendor receipt.`,
    severity: "info",
    entityType: "agent_cash_remittance",
    entityId: next.id,
    branchId: next.stallBranchId,
    visibleToBranchManagers: true,
    visibleToSysAdmin: true,
    requiresAcknowledgement: false,
    metadata: { remittanceId: next.id, agentConfirmedAt: next.agentConfirmedAt },
  });

  return { ok: true, remittance: next };
}

export function computeShiftCashContext(shiftId: string): { salesCash: number; remittedApproved: number; pending: number } {
  const salesCash = round2(
    listSales()
      .filter((s) => s.shiftId === shiftId && s.status === "completed" && s.paymentMethod === "cash")
      .reduce((t, s) => t + s.amountPaid, 0),
  );
  const remittedApproved = round2(
    listRemittances()
      .filter((r) => r.shiftId === shiftId && (r.status === "received_approved" || r.status === "agent_confirmed"))
      .reduce((t, r) => t + r.amountDeclared, 0),
  );
  return { salesCash, remittedApproved, pending: round2(Math.max(0, salesCash - remittedApproved)) };
}

