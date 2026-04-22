/**
 * Deterministic PIN hashing for terminal profiles (browser-only).
 * Matches verification in `verifyTerminalPin` — not a password vault; use Supabase + server policy for production hardening.
 */
export async function hashTerminalPin(terminalCode: string, pin: string): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("Web Crypto not available");
  }
  const enc = new TextEncoder();
  const data = enc.encode(`seigen.terminal.pin\0${terminalCode.trim().toUpperCase()}\0${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyTerminalPin(terminalCode: string, pin: string, pinHash: string | null): Promise<boolean> {
  if (!pinHash) return false;
  const h = await hashTerminalPin(terminalCode, pin);
  return h === pinHash;
}
