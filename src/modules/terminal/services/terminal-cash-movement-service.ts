import type { Id } from "@/modules/inventory/types/models";
import type { TerminalCashMovement, TerminalCashMovementKind, TerminalProfile, TerminalShift } from "../types/terminal-types";
import { appendTerminalCashMovement, listTerminalCashMovements } from "./terminal-local-store";
import { auditTerminalDesk } from "./terminal-audit-desk";

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function listCashMovementsForShift(shiftId: string): TerminalCashMovement[] {
  return listTerminalCashMovements()
    .filter((m) => m.shiftId === shiftId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function totalCashMovementsForShift(shiftId: string): { cashIn: number; cashOut: number } {
  const rows = listCashMovementsForShift(shiftId);
  let cashIn = 0;
  let cashOut = 0;
  for (const r of rows) {
    if (r.kind === "cash_in") cashIn += r.amount;
    else if (r.kind === "cash_out" || r.kind === "paid_out") cashOut += r.amount;
  }
  return { cashIn: roundMoney(cashIn), cashOut: roundMoney(cashOut) };
}

export type RecordCashMovementResult =
  | { ok: true; movement: TerminalCashMovement }
  | { ok: false; error: string };

export function recordShiftCashMovement(input: {
  profile: TerminalProfile;
  shift: TerminalShift;
  kind: TerminalCashMovementKind;
  amount: number;
  memo: string;
}): RecordCashMovementResult {
  if (input.shift.status !== "open") return { ok: false, error: "Shift is not open." };
  const a = roundMoney(Number(input.amount));
  if (!Number.isFinite(a) || a <= 0) return { ok: false, error: "Enter a valid amount." };
  const memo = String(input.memo ?? "").trim();
  if (!memo) return { ok: false, error: "Memo is required." };
  const row: TerminalCashMovement = {
    id: uid("tcash"),
    tenantId: input.profile.tenantId,
    terminalProfileId: input.profile.id,
    branchId: input.profile.branchId as Id,
    shiftId: input.shift.id,
    kind: input.kind,
    amount: a,
    memo: memo.slice(0, 200),
    operatorLabel: input.profile.operatorLabel,
    createdAt: nowIso(),
  };
  appendTerminalCashMovement(row);
  auditTerminalDesk({
    action: "terminal.cash.movement",
    actorLabel: input.profile.operatorLabel,
    entityType: "terminal_cash_movement",
    entityId: row.id,
    notes: `${row.kind} ${row.amount.toFixed(2)} · ${row.memo}`,
    afterState: { shiftId: row.shiftId, branchId: row.branchId, amount: row.amount, kind: row.kind },
    correlationId: `cash_${row.id}_${Date.now()}`,
  });
  return { ok: true, movement: row };
}

