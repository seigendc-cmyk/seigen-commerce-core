import { browserLocalJson } from "@/modules/inventory/services/storage";
import { dispatchFinancialLedgersUpdated } from "./financial-events";
import { setScheduledNextDueDate } from "./creditor-schedule";
import { setScheduledDebtorCollectionDate } from "./debtor-schedule";

const NS = { namespace: "seigen.financial", version: 1 as const };

export type ScheduleChangeKind = "creditor" | "debtor";

export type ScheduleChangeRequestStatus = "pending" | "approved" | "rejected";

export type ScheduleChangeRequest = {
  id: string;
  kind: ScheduleChangeKind;
  entityId: string;
  entityName: string;
  proposedDateIso: string;
  /** Human-readable prior obligation (scheduled or invoice-derived) at request time. */
  previousDateKey?: string;
  status: ScheduleChangeRequestStatus;
  createdAt: string;
  resolvedAt?: string;
};

type Db = { requests: ScheduleChangeRequest[] };

function uid(): string {
  return `sch_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function getDb(): Db {
  const store = browserLocalJson(NS);
  if (!store) return { requests: [] };
  return store.read<Db>("schedule_change_queue", { requests: [] });
}

function setDb(db: Db) {
  const store = browserLocalJson(NS);
  if (!store) return;
  store.write("schedule_change_queue", db);
}

export const SCHEDULE_APPROVAL_QUEUE_UPDATED = "seigen-schedule-approval-queue-updated";

function notifyQueue() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SCHEDULE_APPROVAL_QUEUE_UPDATED));
  dispatchFinancialLedgersUpdated();
}

export function listScheduleChangeRequests(limit = 200): ScheduleChangeRequest[] {
  return getDb()
    .requests.slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export function listPendingScheduleChangeRequests(): ScheduleChangeRequest[] {
  return getDb()
    .requests.filter((r) => r.status === "pending")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * Submit a reschedule (missed flow). Replaces any older pending row for the same entity/kind.
 */
export function submitScheduleChangeRequest(input: {
  kind: ScheduleChangeKind;
  entityId: string;
  entityName: string;
  proposedDateIso: string;
  previousDateKey?: string;
}): ScheduleChangeRequest {
  const db = getDb();
  db.requests = db.requests.filter(
    (r) => !(r.kind === input.kind && r.entityId === input.entityId && r.status === "pending"),
  );
  const row: ScheduleChangeRequest = {
    id: uid(),
    kind: input.kind,
    entityId: input.entityId,
    entityName: input.entityName.trim() || (input.kind === "creditor" ? "Supplier" : "Customer"),
    proposedDateIso: input.proposedDateIso,
    previousDateKey: input.previousDateKey,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  db.requests.push(row);
  setDb(db);
  notifyQueue();
  return row;
}

export function approveScheduleChangeRequest(id: string): { ok: true } | { ok: false; error: string } {
  const db = getDb();
  const r = db.requests.find((x) => x.id === id);
  if (!r) return { ok: false, error: "Request not found." };
  if (r.status !== "pending") return { ok: false, error: "Request is not pending." };

  if (r.kind === "creditor") {
    setScheduledNextDueDate(r.entityId, r.proposedDateIso);
  } else {
    setScheduledDebtorCollectionDate(r.entityId, r.proposedDateIso);
  }

  r.status = "approved";
  r.resolvedAt = new Date().toISOString();
  setDb(db);
  notifyQueue();
  return { ok: true };
}

export function rejectScheduleChangeRequest(id: string): { ok: true } | { ok: false; error: string } {
  const db = getDb();
  const r = db.requests.find((x) => x.id === id);
  if (!r) return { ok: false, error: "Request not found." };
  if (r.status !== "pending") return { ok: false, error: "Request is not pending." };
  r.status = "rejected";
  r.resolvedAt = new Date().toISOString();
  setDb(db);
  notifyQueue();
  return { ok: true };
}
