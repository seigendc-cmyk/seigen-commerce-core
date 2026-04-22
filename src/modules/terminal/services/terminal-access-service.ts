import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";
import type { TerminalProfile } from "../types/terminal-types";
import { listTerminalProfiles } from "./terminal-local-store";
import { auditTerminalDesk } from "./terminal-audit-desk";
import { verifyTerminalPin } from "./terminal-pin";
import { readAccessAttemptState, writeAccessAttemptState } from "./terminal-local-store";

function normalizeCode(code: string): string {
  return code.trim().toLowerCase();
}

function nowIso(): string {
  return new Date().toISOString();
}

function addSeconds(iso: string, seconds: number): string {
  const d = new Date(iso);
  d.setSeconds(d.getSeconds() + seconds);
  return d.toISOString();
}

function isLocked(st: { lockedUntil: string | null } | null): boolean {
  if (!st?.lockedUntil) return false;
  return st.lockedUntil.localeCompare(nowIso()) > 0;
}

function recordFail(code: string, reason: string): { locked: boolean; lockedUntil: string | null } {
  const st = readAccessAttemptState(code) ?? { fails: 0, firstAt: nowIso(), lockedUntil: null };
  const windowSeconds = 5 * 60;
  const lockSeconds = 10 * 60;

  const windowStart = st.firstAt;
  const expired = addSeconds(windowStart, windowSeconds).localeCompare(nowIso()) <= 0;
  const next = expired ? { fails: 1, firstAt: nowIso(), lockedUntil: null } : { ...st, fails: st.fails + 1 };

  if (next.fails >= 6) {
    next.lockedUntil = addSeconds(nowIso(), lockSeconds);
  }
  writeAccessAttemptState(code, next);

  auditTerminalDesk({
    action: "terminal.access.attempt.fail",
    actorLabel: "anonymous",
    notes: reason,
    afterState: { accessCode: normalizeCode(code), fails: next.fails, lockedUntil: next.lockedUntil },
  });

  return { locked: Boolean(next.lockedUntil) && isLocked(next), lockedUntil: next.lockedUntil };
}

function clearAttempts(code: string): void {
  writeAccessAttemptState(code, null);
}

export function findTerminalProfileByAccessCode(accessCode: string): TerminalProfile | null {
  const n = normalizeCode(accessCode);
  const hit = listTerminalProfiles().find((p) => normalizeCode(p.terminalCode) === n);
  return hit ?? null;
}

export type TerminalAccessResolution =
  | { ok: true; profile: TerminalProfile }
  | { ok: false; error: string; profile?: TerminalProfile | null };

export function resolveTerminalProfileForEntry(accessCode: string): TerminalAccessResolution {
  const attemptState = readAccessAttemptState(accessCode);
  if (isLocked(attemptState)) {
    auditTerminalDesk({
      action: "terminal.access.blocked",
      actorLabel: "anonymous",
      notes: "Access temporarily locked due to repeated failures",
      afterState: { accessCode: normalizeCode(accessCode), lockedUntil: attemptState?.lockedUntil },
    });
    return { ok: false, error: "Too many attempts. Try again later.", profile: null };
  }
  const profile = findTerminalProfileByAccessCode(accessCode);
  if (!profile) {
    recordFail(accessCode, "Unknown terminal code");
    return { ok: false, error: "Unknown access code.", profile: null };
  }
  if (!profile.isActive) {
    auditTerminalDesk({
      action: "terminal.access.blocked",
      actorLabel: profile.operatorLabel,
      entityType: "terminal_profile",
      entityId: profile.id,
      notes: "Inactive terminal profile",
    });
    return { ok: false, error: "This terminal is inactive.", profile };
  }
  const branch = InventoryRepo.getBranch(profile.branchId);
  if (!branch) {
    auditTerminalDesk({
      action: "terminal.access.blocked",
      actorLabel: profile.operatorLabel,
      entityType: "terminal_profile",
      entityId: profile.id,
      notes: "Missing branch binding",
    });
    return { ok: false, error: "Branch for this terminal is not available.", profile };
  }
  // Successful resolution clears prior failure window for this code.
  clearAttempts(accessCode);
  return { ok: true, profile };
}

export async function verifyTerminalEntryPin(profile: TerminalProfile, pin: string): Promise<boolean> {
  if (!profile.requiresPin) return true;
  const attemptState = readAccessAttemptState(profile.terminalCode);
  if (isLocked(attemptState)) return false;
  const ok = await verifyTerminalPin(profile.terminalCode, pin, profile.pinHash);
  auditTerminalDesk({
    action: ok ? "terminal.pin.ok" : "terminal.pin.fail",
    actorLabel: profile.operatorLabel,
    entityType: "terminal_profile",
    entityId: profile.id,
    notes: ok ? null : "PIN verification failed",
  });
  if (!ok) {
    recordFail(profile.terminalCode, "PIN verification failed");
  } else {
    clearAttempts(profile.terminalCode);
  }
  return ok;
}
