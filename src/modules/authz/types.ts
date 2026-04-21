import type { AuthzReasonCode, AuthzRiskLevel, AuthzScopeEntityType, DeskCode } from "./constants";

export type PermissionMatchedBy = "role" | "user_override_grant" | "user_override_deny" | "scope" | "none";

export type PermissionCheckInput = {
  tenantId: string;
  userId: string;
  permissionKey: string;
  scopeEntityType?: AuthzScopeEntityType;
  scopeEntityId?: string;
  scopeCode?: string;
  resourceContext?: Record<string, unknown>;
  requireActiveUser?: boolean;
  requireScope?: boolean;
  requireNotExpired?: boolean;
  critical?: {
    /** If provided, this is used for governance audit/logging and reason enforcement. */
    reason?: string;
    /** For future step-up auth (OTP/supervisor passcode/approval) */
    stepUpToken?: string;
  };
};

export type PermissionDependencyFailure = {
  permissionKey: string;
  requiredPermissionKey: string;
  result: PermissionCheckResult;
};

export type PermissionCheckResult = {
  allowed: boolean;
  permissionKey: string;
  reasonCode: AuthzReasonCode;
  reasonMessage: string;
  matchedBy: PermissionMatchedBy;
  riskLevel?: AuthzRiskLevel;
  isCritical?: boolean;
  dependencyFailures?: PermissionDependencyFailure[];
  resolvedRoleCodes?: string[];
  scopeMatched?: boolean;
  expiresAt?: string | null;
};

export type EffectiveAccessSnapshot = {
  tenantId: string;
  userId: string;
  generatedAt: string;
  assignedRoles: Array<{ roleId: string; roleCode: string; name: string; isPrimary: boolean }>;
  primaryRoleCode: string | null;
  effectivePermissionKeys: string[];
  deniedPermissionKeys: string[];
  grantedByOverrides: string[];
  deniedByOverrides: string[];
  scopes: Array<{
    scopeEntityType: AuthzScopeEntityType;
    scopeEntityId: string | null;
    scopeCode: string | null;
    accessLevel: "allowed" | "denied" | "read_only";
    expiresAt: string | null;
  }>;
  accessibleDesks: DeskAccessResult[];
  riskSummary: {
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
  };
};

export type DeskAccessResult = {
  deskCode: DeskCode;
  allowed: boolean;
  matchedPermissionKey: string;
  scopeMatched: boolean;
  source: "role" | "override" | "none";
};

export type GovernanceAuditInput = {
  actorUserId: string;
  tenantId: string;
  entityType: string;
  entityId?: string | null;
  actionCode: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
  metadata?: Record<string, unknown>;
};

export type PermissionMeta = {
  id: string;
  permissionKey: string;
  label: string;
  description: string | null;
  moduleCode: string;
  categoryCode: string;
  resourceCode: string;
  actionCode: string;
  riskLevel: AuthzRiskLevel;
  scopeType: AuthzScopeEntityType;
  isProtected: boolean;
  isDestructive: boolean;
  isApprovalCapable: boolean;
  isActive: boolean;
  metadata: Record<string, unknown>;
};

export type AuthzUserRoleAssignment = {
  id: string;
  roleId: string;
  roleCode: string;
  roleName: string;
  roleActive: boolean;
  roleArchived: boolean;
  isPrimary: boolean;
  isActive: boolean;
  expiresAt: string | null;
};

export type AuthzUserOverride = {
  id: string;
  permissionKey: string;
  overrideType: "grant" | "deny";
  isActive: boolean;
  expiresAt: string | null;
  reason: string | null;
};

export type AuthzUserScope = {
  id: string;
  scopeEntityType: AuthzScopeEntityType;
  scopeEntityId: string | null;
  scopeCode: string | null;
  accessLevel: "allowed" | "denied" | "read_only";
  isActive: boolean;
  expiresAt: string | null;
};

export type AuthzContext = {
  tenantId: string;
  userId: string;
  userActive: boolean;
  roleAssignments: AuthzUserRoleAssignment[];
  rolePermissionKeys: string[];
  overrides: AuthzUserOverride[];
  scopes: AuthzUserScope[];
  permissionMetaByKey: Record<string, PermissionMeta>;
  dependenciesByPermissionKey: Record<string, string[]>;
};

