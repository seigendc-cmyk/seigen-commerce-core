import type { DeskNotification, DeskNotificationStatus } from "@/modules/desk/types/desk-notification";
import { dispatchDeskNotificationsUpdated } from "@/modules/desk/services/desk-events";
import { readDeskDb, writeDeskDb } from "@/modules/desk/services/desk-storage";
import { appendDeskAuditEvent } from "@/modules/desk/services/desk-audit";

type Db = { notifications: DeskNotification[] };

function uid(): string {
  return `ntf_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function getDb(): Db {
  return readDeskDb<Db>("desk_notifications", { notifications: [] });
}

function setDb(db: Db) {
  writeDeskDb("desk_notifications", db);
  dispatchDeskNotificationsUpdated();
}

export function createNotification(
  input: Omit<DeskNotification, "id" | "createdAt" | "acknowledgedBy" | "status" | "metadata"> & {
    id?: string;
    createdAt?: string;
    acknowledgedBy?: DeskNotification["acknowledgedBy"];
    status?: DeskNotificationStatus;
    metadata?: Record<string, unknown>;
  },
): DeskNotification {
  const db = getDb();
  const row: DeskNotification = {
    id: input.id ?? uid(),
    createdAt: input.createdAt ?? nowIso(),
    acknowledgedBy: input.acknowledgedBy ?? [],
    status: input.status ?? "active",
    metadata: input.metadata ?? {},
    ...input,
  };
  db.notifications.push(row);
  setDb(db);
  appendDeskAuditEvent({
    sourceKind: "notification",
    sourceId: row.id,
    action: "notification.created",
    actorStaffId: null,
    actorLabel: "system",
    moduleKey: row.moduleKey,
    entityType: row.entityType,
    entityId: row.entityId,
    afterState: { title: row.title, severity: row.severity, status: row.status },
  });
  return row;
}

export function acknowledgeNotification(id: string, staffId: string, actorLabel: string) {
  const db = getDb();
  const row = db.notifications.find((n) => n.id === id);
  if (!row) return { ok: false as const, error: "Notification not found." };
  if (row.acknowledgedBy.some((a) => a.staffId === staffId)) return { ok: true as const };
  const before = { status: row.status, acknowledgedByCount: row.acknowledgedBy.length };
  row.acknowledgedBy.push({ staffId, at: nowIso() });
  if (row.requiresAcknowledgement) row.status = "acknowledged";
  setDb(db);
  appendDeskAuditEvent({
    sourceKind: "notification",
    sourceId: row.id,
    action: "notification.acknowledged",
    actorStaffId: staffId,
    actorLabel,
    moduleKey: row.moduleKey,
    entityType: row.entityType,
    entityId: row.entityId,
    beforeState: before,
    afterState: { status: row.status, acknowledgedByCount: row.acknowledgedBy.length },
  });
  return { ok: true as const };
}

export function resolveNotification(id: string, staffId: string | null, actorLabel: string) {
  const db = getDb();
  const row = db.notifications.find((n) => n.id === id);
  if (!row) return { ok: false as const, error: "Notification not found." };
  const before = { status: row.status };
  row.status = "resolved";
  setDb(db);
  appendDeskAuditEvent({
    sourceKind: "notification",
    sourceId: row.id,
    action: "notification.resolved",
    actorStaffId: staffId,
    actorLabel,
    moduleKey: row.moduleKey,
    entityType: row.entityType,
    entityId: row.entityId,
    beforeState: before,
    afterState: { status: row.status },
  });
  return { ok: true as const };
}

export function expireNotifications(nowIsoStr = nowIso()) {
  const db = getDb();
  let changed = false;
  for (const n of db.notifications) {
    if (n.status === "active" && n.expiresAt && n.expiresAt < nowIsoStr) {
      n.status = "expired";
      changed = true;
    }
  }
  if (changed) setDb(db);
}

export function listNotificationsForDesk(input: {
  staffId: string;
  roleId: string;
  branchScope: "all" | string[];
  isSysAdmin: boolean;
  limit?: number;
}): DeskNotification[] {
  const limit = input.limit ?? 200;
  const branchSet = input.branchScope === "all" ? null : new Set(input.branchScope);

  const rows = getDb().notifications.filter((n) => {
    if (n.status === "expired" || n.status === "resolved") return false;
    if (input.isSysAdmin && n.visibleToSysAdmin) return true;

    if (n.intendedStaffIds?.length) {
      if (!n.intendedStaffIds.includes(input.staffId)) return false;
    } else if (n.intendedRoleIds?.length) {
      if (!n.intendedRoleIds.includes(input.roleId)) return false;
    } else if (!n.visibleToBranchManagers) {
      return false;
    }

    if (!branchSet) return true;
    if (!n.branchId) return true;
    return branchSet.has(n.branchId);
  });

  return rows
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export function listCriticalNotifications(limit = 50): DeskNotification[] {
  return getDb()
    .notifications.filter((n) => n.status === "active" && (n.severity === "critical" || n.severity === "urgent"))
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

