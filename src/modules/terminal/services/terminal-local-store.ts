import { browserLocalJson } from "@/modules/inventory/services/storage";
import type { TerminalCashMovement, TerminalProfile, TerminalSession, TerminalShift } from "../types/terminal-types";

const NS = { namespace: "seigen.terminal", version: 1 as const };

type TerminalDb = {
  profiles: TerminalProfile[];
  sessions: TerminalSession[];
  shifts: TerminalShift[];
  cashMovements?: TerminalCashMovement[];
};

function store() {
  return browserLocalJson(NS);
}

function readDb(): TerminalDb {
  const s = store();
  if (!s) return { profiles: [], sessions: [], shifts: [] };
  return s.read<TerminalDb>("db", { profiles: [], sessions: [], shifts: [] });
}

function writeDb(db: TerminalDb) {
  const s = store();
  if (!s) return;
  s.write("db", db);
}

export function terminalDbStorageKey(): string {
  const s = store();
  return s?.fullKey("db") ?? `${NS.namespace}:v${NS.version}:db`;
}

export function listTerminalProfiles(): TerminalProfile[] {
  return readDb().profiles.slice();
}

export function upsertTerminalProfile(profile: TerminalProfile): void {
  const db = readDb();
  const i = db.profiles.findIndex((p) => p.id === profile.id);
  if (i >= 0) db.profiles[i] = profile;
  else db.profiles.push(profile);
  writeDb(db);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("seigen-terminal-profiles-updated"));
  }
}

export function deleteTerminalProfile(id: string): void {
  const db = readDb();
  db.profiles = db.profiles.filter((p) => p.id !== id);
  writeDb(db);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("seigen-terminal-profiles-updated"));
  }
}

export function appendTerminalSession(row: TerminalSession): void {
  const db = readDb();
  db.sessions.push(row);
  writeDb(db);
}

export function updateTerminalSession(id: string, patch: Partial<TerminalSession>): void {
  const db = readDb();
  const row = db.sessions.find((s) => s.id === id);
  if (!row) return;
  Object.assign(row, patch);
  writeDb(db);
}

export function listTerminalSessionsForProfile(terminalProfileId: string): TerminalSession[] {
  return readDb()
    .sessions.filter((s) => s.terminalProfileId === terminalProfileId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function appendTerminalShift(row: TerminalShift): void {
  const db = readDb();
  db.shifts.push(row);
  writeDb(db);
}

export function updateTerminalShift(id: string, patch: Partial<TerminalShift>): void {
  const db = readDb();
  const row = db.shifts.find((s) => s.id === id);
  if (!row) return;
  Object.assign(row, patch);
  writeDb(db);
}

export function listTerminalShifts(): TerminalShift[] {
  return readDb().shifts.slice();
}

export function appendTerminalCashMovement(row: TerminalCashMovement): void {
  const db = readDb();
  if (!Array.isArray(db.cashMovements)) db.cashMovements = [];
  db.cashMovements.push(row);
  writeDb(db);
}

export function listTerminalCashMovements(): TerminalCashMovement[] {
  const db = readDb();
  return Array.isArray(db.cashMovements) ? db.cashMovements.slice() : [];
}

function activeSessionKey(terminalCode: string): { primary: string; legacy: string } {
  const code = terminalCode.toLowerCase();
  const s = store();
  const scoped = s?.fullKey(`activeSession:${code}`) ?? `${NS.namespace}:v${NS.version}:activeSession:${code}`;
  const legacy = `${NS.namespace}:v${NS.version}:activeSession:${code}`;
  return { primary: scoped, legacy };
}

export function readActiveSessionIdForCode(terminalCode: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const { primary, legacy } = activeSessionKey(terminalCode);
    return window.localStorage.getItem(primary) ?? window.localStorage.getItem(legacy);
  } catch {
    return null;
  }
}

export function writeActiveSessionIdForCode(terminalCode: string, sessionId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    const { primary } = activeSessionKey(terminalCode);
    if (sessionId) window.localStorage.setItem(primary, sessionId);
    else window.localStorage.removeItem(primary);
  } catch {
    /* ignore */
  }
}

type AccessAttemptState = { fails: number; firstAt: string; lockedUntil: string | null };

function attemptsKey(terminalCode: string): string {
  const code = terminalCode.toLowerCase();
  const s = store();
  return s?.fullKey(`attempts:${code}`) ?? `${NS.namespace}:v${NS.version}:attempts:${code}`;
}

export function readAccessAttemptState(terminalCode: string): AccessAttemptState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(attemptsKey(terminalCode));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<AccessAttemptState>;
    return {
      fails: typeof v.fails === "number" && Number.isFinite(v.fails) ? v.fails : 0,
      firstAt: typeof v.firstAt === "string" ? v.firstAt : new Date().toISOString(),
      lockedUntil: typeof v.lockedUntil === "string" ? v.lockedUntil : null,
    };
  } catch {
    return null;
  }
}

export function writeAccessAttemptState(terminalCode: string, next: AccessAttemptState | null): void {
  if (typeof window === "undefined") return;
  try {
    const k = attemptsKey(terminalCode);
    if (!next) window.localStorage.removeItem(k);
    else window.localStorage.setItem(k, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function deviceIdKey(): string {
  const s = store();
  return s?.fullKey("device_id") ?? `${NS.namespace}:v${NS.version}:device_id`;
}

export function readOrCreateTerminalDeviceId(): string {
  if (typeof window === "undefined") return "device_ssr";
  try {
    const k = deviceIdKey();
    const existing = window.localStorage.getItem(k);
    if (existing && existing.trim()) return existing.trim();
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `dev_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    window.localStorage.setItem(k, id);
    return id;
  } catch {
    return `dev_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}
