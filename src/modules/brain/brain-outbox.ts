"use client";

import { browserLocalJson } from "@/modules/inventory/services/storage";
import type { Sale } from "@/modules/pos/types/pos";
import {
  emitPosReceiptReprintedBrainEvent,
  emitPosSaleCompletedBrainEvent,
  emitPosSaleReturnedBrainEvent,
  emitPosSaleVoidedBrainEvent,
  emitTerminalCashMovementRecordedBrainEvent,
  emitTerminalShiftClosedBrainEvent,
  emitTerminalShiftOpenedBrainEvent,
  type EmitBrainEventResult,
} from "./brain-actions";

const NS = { namespace: "seigen.brain", version: 1 as const };

type OutboxRow =
  {
      id: string;
      type: "pos.sale.completed";
      createdAt: string;
      attempts: number;
      nextAttemptAt: string;
      payload: { sale: Sale; correlationId: string; payloadExtras?: Record<string, unknown> };
    }
  | {
      id: string;
      type: "pos.sale.voided";
      createdAt: string;
      attempts: number;
      nextAttemptAt: string;
      payload: { sale: Sale; correlationId: string; reason: string; payloadExtras?: Record<string, unknown> };
    }
  | {
      id: string;
      type: "pos.receipt.reprinted";
      createdAt: string;
      attempts: number;
      nextAttemptAt: string;
      payload: { sale: Sale; correlationId: string; reason: string; payloadExtras?: Record<string, unknown> };
    }
  | {
      id: string;
      type: "pos.sale.returned";
      createdAt: string;
      attempts: number;
      nextAttemptAt: string;
      payload: {
        sale: Sale;
        returnId: string;
        correlationId: string;
        reason: string;
        payloadExtras?: Record<string, unknown>;
        returnPayload: Record<string, unknown>;
      };
    }
  | {
      id: string;
      type: "terminal.shift.opened";
      createdAt: string;
      attempts: number;
      nextAttemptAt: string;
      payload: {
        tenantId: string;
        branchId: string;
        terminalProfileId: string;
        shiftId: string;
        correlationId: string;
        openingFloat: number;
        occurredAt: string;
        payloadExtras?: Record<string, unknown>;
      };
    }
  | {
      id: string;
      type: "terminal.shift.closed";
      createdAt: string;
      attempts: number;
      nextAttemptAt: string;
      payload: {
        tenantId: string;
        branchId: string;
        terminalProfileId: string;
        shiftId: string;
        correlationId: string;
        closingCount: number;
        expectedCashAtClose: number | null;
        cashVariance: number | null;
        varianceReason: string | null;
        occurredAt: string;
        payloadExtras?: Record<string, unknown>;
      };
    }
  | {
      id: string;
      type: "terminal.cash.movement.recorded";
      createdAt: string;
      attempts: number;
      nextAttemptAt: string;
      payload: {
        tenantId: string;
        branchId: string;
        terminalProfileId: string;
        shiftId: string;
        movementId: string;
        kind: "cash_in" | "cash_out" | "paid_out";
        amount: number;
        memo: string;
        correlationId: string;
        occurredAt: string;
        payloadExtras?: Record<string, unknown>;
      };
    };

type OutboxDb = { rows: OutboxRow[] };

function nowIso() {
  return new Date().toISOString();
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function getStore() {
  return browserLocalJson(NS);
}

function readDb(): OutboxDb {
  const s = getStore();
  if (!s) return { rows: [] };
  return s.read<OutboxDb>("outbox", { rows: [] });
}

function writeDb(db: OutboxDb) {
  const s = getStore();
  if (!s) return;
  s.write("outbox", db);
}

function backoffSeconds(attempts: number): number {
  // 2s, 5s, 15s, 60s, 5m, 30m
  const steps = [2, 5, 15, 60, 300, 1800];
  return steps[Math.min(attempts, steps.length - 1)] ?? 1800;
}

export function enqueuePosSaleCompletedBrainEvent(input: {
  sale: Sale;
  correlationId: string;
  payloadExtras?: Record<string, unknown>;
}): void {
  const db = readDb();
  const row: OutboxRow = {
    id: uid("bevt"),
    type: "pos.sale.completed",
    createdAt: nowIso(),
    attempts: 0,
    nextAttemptAt: nowIso(),
    payload: { sale: input.sale, correlationId: input.correlationId, payloadExtras: input.payloadExtras },
  };
  db.rows.push(row);
  writeDb(db);
}

export function enqueuePosSaleVoidedBrainEvent(input: {
  sale: Sale;
  correlationId: string;
  reason: string;
  payloadExtras?: Record<string, unknown>;
}): void {
  const db = readDb();
  const row: OutboxRow = {
    id: uid("bevt"),
    type: "pos.sale.voided",
    createdAt: nowIso(),
    attempts: 0,
    nextAttemptAt: nowIso(),
    payload: {
      sale: input.sale,
      correlationId: input.correlationId,
      reason: input.reason,
      payloadExtras: input.payloadExtras,
    },
  };
  db.rows.push(row);
  writeDb(db);
}

export function enqueuePosReceiptReprintedBrainEvent(input: {
  sale: Sale;
  correlationId: string;
  reason: string;
  payloadExtras?: Record<string, unknown>;
}): void {
  const db = readDb();
  const row: OutboxRow = {
    id: uid("bevt"),
    type: "pos.receipt.reprinted",
    createdAt: nowIso(),
    attempts: 0,
    nextAttemptAt: nowIso(),
    payload: {
      sale: input.sale,
      correlationId: input.correlationId,
      reason: input.reason,
      payloadExtras: input.payloadExtras,
    },
  };
  db.rows.push(row);
  writeDb(db);
}

export function enqueuePosSaleReturnedBrainEvent(input: {
  sale: Sale;
  returnId: string;
  correlationId: string;
  reason: string;
  payloadExtras?: Record<string, unknown>;
  returnPayload: Record<string, unknown>;
}): void {
  const db = readDb();
  const row: OutboxRow = {
    id: uid("bevt"),
    type: "pos.sale.returned",
    createdAt: nowIso(),
    attempts: 0,
    nextAttemptAt: nowIso(),
    payload: {
      sale: input.sale,
      returnId: input.returnId,
      correlationId: input.correlationId,
      reason: input.reason,
      payloadExtras: input.payloadExtras,
      returnPayload: input.returnPayload,
    },
  };
  db.rows.push(row);
  writeDb(db);
}

export function enqueueTerminalShiftOpenedBrainEvent(input: {
  tenantId: string;
  branchId: string;
  terminalProfileId: string;
  shiftId: string;
  correlationId: string;
  openingFloat: number;
  occurredAt: string;
  payloadExtras?: Record<string, unknown>;
}): void {
  const db = readDb();
  const row: OutboxRow = {
    id: uid("bevt"),
    type: "terminal.shift.opened",
    createdAt: nowIso(),
    attempts: 0,
    nextAttemptAt: nowIso(),
    payload: { ...input },
  };
  db.rows.push(row);
  writeDb(db);
}

export function enqueueTerminalShiftClosedBrainEvent(input: {
  tenantId: string;
  branchId: string;
  terminalProfileId: string;
  shiftId: string;
  correlationId: string;
  closingCount: number;
  expectedCashAtClose: number | null;
  cashVariance: number | null;
  varianceReason: string | null;
  occurredAt: string;
  payloadExtras?: Record<string, unknown>;
}): void {
  const db = readDb();
  const row: OutboxRow = {
    id: uid("bevt"),
    type: "terminal.shift.closed",
    createdAt: nowIso(),
    attempts: 0,
    nextAttemptAt: nowIso(),
    payload: { ...input },
  };
  db.rows.push(row);
  writeDb(db);
}

export function enqueueTerminalCashMovementRecordedBrainEvent(input: {
  tenantId: string;
  branchId: string;
  terminalProfileId: string;
  shiftId: string;
  movementId: string;
  kind: "cash_in" | "cash_out" | "paid_out";
  amount: number;
  memo: string;
  correlationId: string;
  occurredAt: string;
  payloadExtras?: Record<string, unknown>;
}): void {
  const db = readDb();
  const row: OutboxRow = {
    id: uid("bevt"),
    type: "terminal.cash.movement.recorded",
    createdAt: nowIso(),
    attempts: 0,
    nextAttemptAt: nowIso(),
    payload: { ...input },
  };
  db.rows.push(row);
  writeDb(db);
}

export async function flushBrainOutbox(): Promise<{ ok: true; flushed: number } | { ok: false; error: string }> {
  try {
    const db = readDb();
    const now = nowIso();
    let flushed = 0;
    const nextRows: OutboxRow[] = [];

    for (const row of db.rows) {
      if (row.nextAttemptAt > now) {
        nextRows.push(row);
        continue;
      }

      let res: EmitBrainEventResult;
      if (row.type === "pos.sale.completed") {
        res = await emitPosSaleCompletedBrainEvent({
          sale: row.payload.sale,
          correlationId: row.payload.correlationId,
          payloadExtras: row.payload.payloadExtras,
        });
      } else if (row.type === "pos.sale.voided") {
        res = await emitPosSaleVoidedBrainEvent({
          sale: row.payload.sale,
          correlationId: row.payload.correlationId,
          reason: row.payload.reason,
          payloadExtras: row.payload.payloadExtras,
        });
      } else if (row.type === "pos.receipt.reprinted") {
        res = await emitPosReceiptReprintedBrainEvent({
          sale: row.payload.sale,
          correlationId: row.payload.correlationId,
          reason: row.payload.reason,
          payloadExtras: row.payload.payloadExtras,
        });
      } else if (row.type === "pos.sale.returned") {
        res = await emitPosSaleReturnedBrainEvent({
          sale: row.payload.sale,
          returnId: row.payload.returnId,
          correlationId: row.payload.correlationId,
          reason: row.payload.reason,
          payloadExtras: row.payload.payloadExtras,
          returnPayload: row.payload.returnPayload as any,
        });
      } else if (row.type === "terminal.shift.opened") {
        res = await emitTerminalShiftOpenedBrainEvent(row.payload as any);
      } else if (row.type === "terminal.shift.closed") {
        res = await emitTerminalShiftClosedBrainEvent(row.payload as any);
      } else if (row.type === "terminal.cash.movement.recorded") {
        res = await emitTerminalCashMovementRecordedBrainEvent(row.payload as any);
      } else {
        res = { ok: false, error: "Unknown outbox row type" };
      }

      if (res.ok && "id" in res) {
        flushed += 1;
        continue; // drop row
      }

      // If emission is skipped (no auth/workspace), keep row and retry later.
      const attempts = row.attempts + 1;
      const wait = backoffSeconds(attempts);
      nextRows.push({
        ...row,
        attempts,
        nextAttemptAt: new Date(Date.now() + wait * 1000).toISOString(),
      });
    }

    writeDb({ rows: nextRows });
    return { ok: true, flushed };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to flush brain outbox." };
  }
}

/**
 * Durable wrapper for key brain events: attempt server emission; queue locally when offline/auth missing/errors occur.
 */
export async function emitPosSaleCompletedBrainEventDurable(input: {
  sale: Sale;
  correlationId: string;
  payloadExtras?: Record<string, unknown>;
}): Promise<EmitBrainEventResult> {
  try {
    const res = await emitPosSaleCompletedBrainEvent(input);
    if (res.ok && "id" in res) return res;
    enqueuePosSaleCompletedBrainEvent(input);
    return res.ok ? { ok: true, skipped: true, reason: "Queued for later emission" } : res;
  } catch (e) {
    enqueuePosSaleCompletedBrainEvent(input);
    return { ok: true, skipped: true, reason: e instanceof Error ? e.message : "Queued for later emission" };
  }
}

export async function emitPosSaleVoidedBrainEventDurable(input: {
  sale: Sale;
  correlationId: string;
  reason: string;
  payloadExtras?: Record<string, unknown>;
}): Promise<EmitBrainEventResult> {
  try {
    const res = await emitPosSaleVoidedBrainEvent(input);
    if (res.ok && "id" in res) return res;
    enqueuePosSaleVoidedBrainEvent(input);
    return res.ok ? { ok: true, skipped: true, reason: "Queued for later emission" } : res;
  } catch (e) {
    enqueuePosSaleVoidedBrainEvent(input);
    return { ok: true, skipped: true, reason: e instanceof Error ? e.message : "Queued for later emission" };
  }
}

export async function emitPosReceiptReprintedBrainEventDurable(input: {
  sale: Sale;
  correlationId: string;
  reason: string;
  payloadExtras?: Record<string, unknown>;
}): Promise<EmitBrainEventResult> {
  try {
    const res = await emitPosReceiptReprintedBrainEvent(input);
    if (res.ok && "id" in res) return res;
    enqueuePosReceiptReprintedBrainEvent(input);
    return res.ok ? { ok: true, skipped: true, reason: "Queued for later emission" } : res;
  } catch (e) {
    enqueuePosReceiptReprintedBrainEvent(input);
    return { ok: true, skipped: true, reason: e instanceof Error ? e.message : "Queued for later emission" };
  }
}

export async function emitPosSaleReturnedBrainEventDurable(input: {
  sale: Sale;
  returnId: string;
  correlationId: string;
  reason: string;
  payloadExtras?: Record<string, unknown>;
  returnPayload: Record<string, unknown>;
}): Promise<EmitBrainEventResult> {
  try {
    const res = await emitPosSaleReturnedBrainEvent({
      sale: input.sale,
      returnId: input.returnId,
      correlationId: input.correlationId,
      reason: input.reason,
      payloadExtras: input.payloadExtras,
      returnPayload: input.returnPayload as any,
    });
    if (res.ok && "id" in res) return res;
    enqueuePosSaleReturnedBrainEvent(input);
    return res.ok ? { ok: true, skipped: true, reason: "Queued for later emission" } : res;
  } catch (e) {
    enqueuePosSaleReturnedBrainEvent(input);
    return { ok: true, skipped: true, reason: e instanceof Error ? e.message : "Queued for later emission" };
  }
}

export async function emitTerminalShiftOpenedBrainEventDurable(input: {
  tenantId: string;
  branchId: string;
  terminalProfileId: string;
  shiftId: string;
  correlationId: string;
  openingFloat: number;
  occurredAt: string;
  payloadExtras?: Record<string, unknown>;
}): Promise<EmitBrainEventResult> {
  try {
    const res = await emitTerminalShiftOpenedBrainEvent(input as any);
    if (res.ok && "id" in res) return res;
    enqueueTerminalShiftOpenedBrainEvent(input);
    return res.ok ? { ok: true, skipped: true, reason: "Queued for later emission" } : res;
  } catch (e) {
    enqueueTerminalShiftOpenedBrainEvent(input);
    return { ok: true, skipped: true, reason: e instanceof Error ? e.message : "Queued for later emission" };
  }
}

export async function emitTerminalShiftClosedBrainEventDurable(input: {
  tenantId: string;
  branchId: string;
  terminalProfileId: string;
  shiftId: string;
  correlationId: string;
  closingCount: number;
  expectedCashAtClose: number | null;
  cashVariance: number | null;
  varianceReason: string | null;
  occurredAt: string;
  payloadExtras?: Record<string, unknown>;
}): Promise<EmitBrainEventResult> {
  try {
    const res = await emitTerminalShiftClosedBrainEvent(input as any);
    if (res.ok && "id" in res) return res;
    enqueueTerminalShiftClosedBrainEvent(input);
    return res.ok ? { ok: true, skipped: true, reason: "Queued for later emission" } : res;
  } catch (e) {
    enqueueTerminalShiftClosedBrainEvent(input);
    return { ok: true, skipped: true, reason: e instanceof Error ? e.message : "Queued for later emission" };
  }
}

export async function emitTerminalCashMovementRecordedBrainEventDurable(input: {
  tenantId: string;
  branchId: string;
  terminalProfileId: string;
  shiftId: string;
  movementId: string;
  kind: "cash_in" | "cash_out" | "paid_out";
  amount: number;
  memo: string;
  correlationId: string;
  occurredAt: string;
  payloadExtras?: Record<string, unknown>;
}): Promise<EmitBrainEventResult> {
  try {
    const res = await emitTerminalCashMovementRecordedBrainEvent(input as any);
    if (res.ok && "id" in res) return res;
    enqueueTerminalCashMovementRecordedBrainEvent(input);
    return res.ok ? { ok: true, skipped: true, reason: "Queued for later emission" } : res;
  } catch (e) {
    enqueueTerminalCashMovementRecordedBrainEvent(input);
    return { ok: true, skipped: true, reason: e instanceof Error ? e.message : "Queued for later emission" };
  }
}

