import type { Id } from "@/modules/inventory/types/models";
import type { TerminalSession, TerminalShift } from "../types/terminal-types";
import { appendTerminalShift, listTerminalShifts, updateTerminalShift } from "./terminal-local-store";
import { auditTerminalDesk } from "./terminal-audit-desk";
import { emitTerminalShiftClosedBrainEventDurable, emitTerminalShiftOpenedBrainEventDurable } from "@/modules/brain/brain-outbox";

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function getOpenTerminalShift(terminalProfileId: string): TerminalShift | null {
  const open = listTerminalShifts()
    .filter((s) => s.terminalProfileId === terminalProfileId && s.status === "open")
    .sort((a, b) => b.openedAt.localeCompare(a.openedAt))[0];
  return open ?? null;
}

export function getMostRecentClosedTerminalShift(terminalProfileId: string): TerminalShift | null {
  const row = listTerminalShifts()
    .filter((s) => s.terminalProfileId === terminalProfileId && s.status === "closed" && s.closedAt)
    .sort((a, b) => (b.closedAt ?? "").localeCompare(a.closedAt ?? ""))[0];
  return row ?? null;
}

export function openTerminalShift(input: {
  terminalProfileId: string;
  branchId: Id;
  session: TerminalSession;
  openingFloat: number;
  operatorLabel: string;
}): TerminalShift {
  const existing = getOpenTerminalShift(input.terminalProfileId);
  if (existing) {
    auditTerminalDesk({
      action: "terminal.shift.open.blocked",
      actorLabel: input.operatorLabel,
      entityType: "terminal_shift",
      entityId: existing.id,
      notes: "Shift already open",
      afterState: { existingShiftId: existing.id },
    });
    return existing;
  }
  if (input.session.sessionStatus !== "active" || input.session.endedAt) {
    throw new Error("Session is not active.");
  }
  if (input.session.branchId !== input.branchId) {
    throw new Error("Shift branch must match the active session branch.");
  }
  const row: TerminalShift = {
    id: uid("tshift"),
    terminalProfileId: input.terminalProfileId,
    branchId: input.branchId,
    sessionId: input.session.id,
    status: "open",
    openingFloat: Math.round(input.openingFloat * 100) / 100,
    closingCount: null,
    openedAt: nowIso(),
    closedAt: null,
  };
  appendTerminalShift(row);
  auditTerminalDesk({
    action: "terminal.shift.open",
    actorLabel: input.operatorLabel,
    entityType: "terminal_shift",
    entityId: row.id,
    afterState: { openingFloat: row.openingFloat, branchId: input.branchId },
  });
  void emitTerminalShiftOpenedBrainEventDurable({
    tenantId: input.session.tenantId,
    branchId: String(input.branchId),
    terminalProfileId: input.terminalProfileId,
    shiftId: row.id,
    correlationId: `tshift_open_${row.id}_${Date.now()}`,
    openingFloat: row.openingFloat,
    occurredAt: row.openedAt,
  });
  return row;
}

export function closeTerminalShift(
  shift: TerminalShift,
  input: {
    closingCount: number;
    expectedCashAtClose?: number | null;
    cashVariance?: number | null;
    cashVarianceReason?: string | null;
    operatorLabel: string;
    tenantId?: string;
  },
): void {
  if (shift.status !== "open") {
    auditTerminalDesk({
      action: "terminal.shift.close.blocked",
      actorLabel: input.operatorLabel,
      entityType: "terminal_shift",
      entityId: shift.id,
      notes: "Shift is not open",
    });
    return;
  }
  const expected = input.expectedCashAtClose != null ? Math.round(Number(input.expectedCashAtClose) * 100) / 100 : null;
  const variance = input.cashVariance != null ? Math.round(Number(input.cashVariance) * 100) / 100 : null;
  const reason = typeof input.cashVarianceReason === "string" ? input.cashVarianceReason.trim().slice(0, 280) : null;
  updateTerminalShift(shift.id, {
    status: "closed",
    closedAt: nowIso(),
    closingCount: Math.round(input.closingCount * 100) / 100,
    expectedCashAtClose: expected,
    cashVariance: variance,
    cashVarianceReason: reason,
  });
  auditTerminalDesk({
    action: "terminal.shift.close",
    actorLabel: input.operatorLabel,
    entityType: "terminal_shift",
    entityId: shift.id,
    afterState: { closingCount: input.closingCount, expectedCashAtClose: expected, cashVariance: variance },
  });
  void emitTerminalShiftClosedBrainEventDurable({
    tenantId: input.tenantId ?? "local",
    branchId: String(shift.branchId),
    terminalProfileId: shift.terminalProfileId,
    shiftId: shift.id,
    correlationId: `tshift_close_${shift.id}_${Date.now()}`,
    closingCount: Math.round(input.closingCount * 100) / 100,
    expectedCashAtClose: expected,
    cashVariance: variance,
    varianceReason: reason,
    occurredAt: nowIso(),
  });
}
