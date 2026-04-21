import { DEFAULT_CRITICAL_PERMISSION_KEYS } from "./constants";
import type { PermissionMeta } from "./types";

export type CriticalActionEvaluation = {
  isCritical: boolean;
  requiresReason: boolean;
  requiresAudit: boolean;
  requiresStepUp: boolean;
};

export function isCriticalPermission(permissionKey: string, meta?: PermissionMeta | null): boolean {
  if (meta?.riskLevel === "critical") return true;
  return DEFAULT_CRITICAL_PERMISSION_KEYS.has(permissionKey);
}

export function requiresReason(permissionKey: string, meta?: PermissionMeta | null): boolean {
  if (meta?.riskLevel === "critical") return true;
  if (meta?.riskLevel === "high" && meta?.isDestructive) return true;
  return DEFAULT_CRITICAL_PERMISSION_KEYS.has(permissionKey);
}

export function requiresAudit(permissionKey: string, meta?: PermissionMeta | null): boolean {
  if (meta?.riskLevel === "critical") return true;
  if (meta?.riskLevel === "high") return true;
  return DEFAULT_CRITICAL_PERMISSION_KEYS.has(permissionKey);
}

export function requiresStepUp(permissionKey: string, meta?: PermissionMeta | null): boolean {
  // Framework hook for future OTP/supervisor passcode/approval. Currently always false.
  void permissionKey;
  void meta;
  return false;
}

export function evaluateCriticalAction(permissionKey: string, meta?: PermissionMeta | null): CriticalActionEvaluation {
  const isCritical = isCriticalPermission(permissionKey, meta);
  return {
    isCritical,
    requiresReason: isCritical && requiresReason(permissionKey, meta),
    requiresAudit: isCritical && requiresAudit(permissionKey, meta),
    requiresStepUp: isCritical && requiresStepUp(permissionKey, meta),
  };
}

