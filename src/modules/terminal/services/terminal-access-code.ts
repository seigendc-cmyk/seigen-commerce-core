import { listTerminalProfiles } from "./terminal-local-store";

/** Unambiguous uppercase chars for operator-readable codes (no 0/O, 1/I). */
const SEGMENT_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function randomSegment(length: number): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += SEGMENT_ALPHABET.charAt(Math.floor(Math.random() * SEGMENT_ALPHABET.length));
  }
  return out;
}

function normalizeCodeKey(code: string): string {
  return code.trim().toUpperCase();
}

/** Returns true if no profile already uses this code (case-insensitive). */
export function isTerminalAccessCodeAvailable(code: string): boolean {
  const key = normalizeCodeKey(code);
  if (!key) return false;
  const taken = new Set(listTerminalProfiles().map((p) => normalizeCodeKey(p.terminalCode)));
  return !taken.has(key);
}

/**
 * Generates a new terminal access code. There is no global built-in code — each value is
 * minted here (or typed manually in SysAdmin) and stored with the profile in `seigen.terminal` local DB.
 *
 * Format: `TERM-` + 6 alphanumeric characters (readable, unambiguous charset).
 */
export function generateTerminalAccessCode(): string {
  const taken = new Set(listTerminalProfiles().map((p) => normalizeCodeKey(p.terminalCode)));
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const code = `TERM-${randomSegment(6)}`;
    if (!taken.has(code)) return code;
  }
  return `TERM-${randomSegment(4)}-${randomSegment(4)}`;
}
