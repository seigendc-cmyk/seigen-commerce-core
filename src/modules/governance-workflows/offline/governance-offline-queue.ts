"use client";

import { browserLocalJson } from "@/modules/inventory/services/storage";

const NS = { namespace: "seigen.governance.offline", version: 1 as const };
export const GOVERNANCE_OFFLINE_EVENT = "seigen-governance-offline-queue-updated";

export type OfflineQueueStatus = "queued" | "syncing" | "synced" | "failed" | "discarded";

export type OfflineQueueItemKind = "approval.stage_action" | "step_up.supervisor_passcode" | "comment.draft";

export type OfflineQueueItem = {
  tempId: string;
  kind: OfflineQueueItemKind;
  status: OfflineQueueStatus;
  createdAt: string;
  updatedAt: string;
  lastError?: string | null;
  payload: Record<string, unknown>;
};

type Db = { items: OfflineQueueItem[] };

function nowIso() {
  return new Date().toISOString();
}

function uid() {
  return `off_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function getDb(): Db {
  const store = browserLocalJson(NS);
  if (!store) return { items: [] };
  return store.read<Db>("queue", { items: [] });
}

function setDb(db: Db) {
  const store = browserLocalJson(NS);
  if (!store) return;
  store.write("queue", db);
  window.dispatchEvent(new Event(GOVERNANCE_OFFLINE_EVENT));
}

export function enqueueOffline(kind: OfflineQueueItemKind, payload: Record<string, unknown>): OfflineQueueItem {
  const db = getDb();
  const row: OfflineQueueItem = {
    tempId: uid(),
    kind,
    status: "queued",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    payload,
  };
  db.items.push(row);
  setDb(db);
  return row;
}

export function listOfflineQueue(): OfflineQueueItem[] {
  return getDb().items.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function patchOfflineItem(tempId: string, patch: Partial<OfflineQueueItem>) {
  const db = getDb();
  const idx = db.items.findIndex((x) => x.tempId === tempId);
  if (idx < 0) return;
  db.items[idx] = { ...db.items[idx], ...patch, updatedAt: nowIso() };
  setDb(db);
}

export function discardOfflineItem(tempId: string) {
  const db = getDb();
  db.items = db.items.map((x) => (x.tempId === tempId ? { ...x, status: "discarded", updatedAt: nowIso() } : x));
  setDb(db);
}

