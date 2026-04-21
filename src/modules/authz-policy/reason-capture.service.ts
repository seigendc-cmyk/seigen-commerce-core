import type { ExecutionPolicyRow } from "./types";

const MIN_LEN = 4;

export function isReasonRequired(policy: ExecutionPolicyRow | null, opts: { criticalRequiresReason?: boolean }): boolean {
  if (opts.criticalRequiresReason) return true;
  return Boolean(policy?.requiresReason);
}

export function validateReason(reason: string | null | undefined): { ok: true; reason: string } | { ok: false; error: string } {
  const r = (reason ?? "").trim();
  if (r.length < MIN_LEN) return { ok: false, error: `Reason must be at least ${MIN_LEN} characters.` };
  return { ok: true, reason: r };
}

export function enrichAuditWithReason(reason: string | undefined): { reason?: string } {
  if (!reason?.trim()) return {};
  return { reason: reason.trim() };
}
