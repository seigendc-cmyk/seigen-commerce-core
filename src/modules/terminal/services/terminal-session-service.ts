import type { Id } from "@/modules/inventory/types/models";
import type { TerminalProfile, TerminalSession } from "../types/terminal-types";
import {
  appendTerminalSession,
  listTerminalSessionsForProfile,
  readActiveSessionIdForCode,
  readOrCreateTerminalDeviceId,
  updateTerminalSession,
  writeActiveSessionIdForCode,
} from "./terminal-local-store";
import { auditTerminalDesk } from "./terminal-audit-desk";

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function deviceSnapshot(): Record<string, unknown> {
  if (typeof navigator === "undefined") return {};
  return {
    deviceId: readOrCreateTerminalDeviceId(),
    userAgent: navigator.userAgent,
    language: navigator.language,
    onLine: navigator.onLine,
  };
}

function addHours(iso: string, hours: number): string {
  const d = new Date(iso);
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

function isExpired(session: TerminalSession): boolean {
  if (!session.expiresAt) return false;
  return session.expiresAt.localeCompare(nowIso()) <= 0;
}

export function getPersistedActiveSession(profile: TerminalProfile): TerminalSession | null {
  const sid = readActiveSessionIdForCode(profile.terminalCode);
  if (!sid) return null;
  const row = listTerminalSessionsForProfile(profile.id).find((s) => s.id === sid);
  if (!row || row.sessionStatus !== "active" || row.endedAt) return null;
  if (isExpired(row)) return null;
  if (row.profileUpdatedAtSnapshot && row.profileUpdatedAtSnapshot !== profile.updatedAt) return null;
  return row;
}

export function startTerminalSession(profile: TerminalProfile, authStrength: TerminalSession["authStrength"] = "code"): TerminalSession {
  const startedAt = nowIso();
  const row: TerminalSession = {
    id: uid("tsess"),
    tenantId: profile.tenantId,
    terminalProfileId: profile.id,
    userId: profile.userId,
    branchId: profile.branchId as Id,
    stallId: profile.stallId,
    startedAt,
    endedAt: null,
    sessionStatus: "active",
    permissionsSnapshot: (profile.permissions ?? []).slice(),
    profileUpdatedAtSnapshot: profile.updatedAt,
    terminalCodeSnapshot: profile.terminalCode,
    operatorLabelSnapshot: profile.operatorLabel,
    roleSnapshot: profile.role,
    portalTypeSnapshot: profile.portalType,
    authStrength,
    expiresAt: addHours(startedAt, 12),
    deviceInfo: deviceSnapshot(),
    lastSeenAt: startedAt,
  };
  appendTerminalSession(row);
  writeActiveSessionIdForCode(profile.terminalCode, row.id);
  auditTerminalDesk({
    action: "terminal.session.start",
    actorLabel: profile.operatorLabel,
    entityType: "terminal_session",
    entityId: row.id,
    afterState: { branchId: profile.branchId, terminalProfileId: profile.id },
  });
  return row;
}

export function touchTerminalSession(session: TerminalSession): void {
  updateTerminalSession(session.id, { lastSeenAt: nowIso() });
}

export function endTerminalSession(profile: TerminalProfile, session: TerminalSession): void {
  updateTerminalSession(session.id, {
    endedAt: nowIso(),
    sessionStatus: "ended",
    lastSeenAt: nowIso(),
  });
  writeActiveSessionIdForCode(profile.terminalCode, null);
  auditTerminalDesk({
    action: "terminal.session.end",
    actorLabel: profile.operatorLabel,
    entityType: "terminal_session",
    entityId: session.id,
  });
}

export function revokeTerminalSession(profile: TerminalProfile, session: TerminalSession, reason: string): void {
  updateTerminalSession(session.id, {
    endedAt: nowIso(),
    sessionStatus: "revoked",
    lastSeenAt: nowIso(),
  });
  writeActiveSessionIdForCode(profile.terminalCode, null);
  auditTerminalDesk({
    action: "terminal.session.revoked",
    actorLabel: profile.operatorLabel,
    entityType: "terminal_session",
    entityId: session.id,
    notes: reason,
  });
}
