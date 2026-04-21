import type { DeskAuditEvent } from "@/modules/desk/types/desk-audit";
import { dispatchDeskAuditUpdated } from "@/modules/desk/services/desk-events";
import { readDeskDb, writeDeskDb } from "@/modules/desk/services/desk-storage";

type Db = { events: DeskAuditEvent[] };

function uid(): string {
  return `audit_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function getDb(): Db {
  return readDeskDb<Db>("desk_audit", { events: [] });
}

function setDb(db: Db) {
  writeDeskDb("desk_audit", db);
  dispatchDeskAuditUpdated();
}

export function listDeskAuditEvents(limit = 200): DeskAuditEvent[] {
  return getDb()
    .events.slice()
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, limit);
}

export function appendDeskAuditEvent(input: Omit<DeskAuditEvent, "id" | "occurredAt"> & { occurredAt?: string }): DeskAuditEvent {
  const db = getDb();
  const row: DeskAuditEvent = {
    id: uid(),
    occurredAt: input.occurredAt ?? nowIso(),
    ...input,
  };
  db.events.push(row);
  setDb(db);
  return row;
}

