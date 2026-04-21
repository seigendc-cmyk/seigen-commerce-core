import type { RbacRiskLevel, RbacScopeType, RbacOverrideType } from "@/modules/rbac/rbac-constants";

export const AUTHZ_REASON_CODES = [
  "ALLOWED",
  "DENIED_NOT_CONFIGURED",
  "DENIED_NOT_SIGNED_IN",
  "DENIED_NO_WORKSPACE",
  "DENIED_PERMISSION_NOT_FOUND",
  "DENIED_NO_ACTIVE_ROLE",
  "DENIED_PERMISSION_NOT_GRANTED",
  "DENIED_EXPLICIT_USER_OVERRIDE",
  "DENIED_USER_INACTIVE",
  "DENIED_ROLE_INACTIVE",
  "DENIED_ROLE_ASSIGNMENT_EXPIRED",
  "DENIED_OVERRIDE_EXPIRED",
  "DENIED_SCOPE_REQUIRED",
  "DENIED_SCOPE_MISMATCH",
  "DENIED_DEPENDENCY_FAILURE",
  "DENIED_CRITICAL_ACTION_REQUIRES_STEP_UP",
  "DENIED_CRITICAL_ACTION_REQUIRES_REASON",
  "DENIED_TENANT_MISMATCH",
] as const;

export type AuthzReasonCode = (typeof AUTHZ_REASON_CODES)[number];

export const AUTHZ_SCOPE_ENTITY_TYPES = ["tenant", "branch", "warehouse", "terminal", "desk"] as const satisfies readonly RbacScopeType[];
export type AuthzScopeEntityType = (typeof AUTHZ_SCOPE_ENTITY_TYPES)[number];

export const AUTHZ_OVERRIDE_TYPES = ["grant", "deny"] as const satisfies readonly RbacOverrideType[];
export type AuthzOverrideType = (typeof AUTHZ_OVERRIDE_TYPES)[number];

export const AUTHZ_RISK_LEVELS = ["low", "medium", "high", "critical"] as const satisfies readonly RbacRiskLevel[];
export type AuthzRiskLevel = (typeof AUTHZ_RISK_LEVELS)[number];

export const DESK_CODES = [
  "sysadmin_desk",
  "executive_desk",
  "branch_desk",
  "inventory_desk",
  "pos_desk",
  "procurement_desk",
  "finance_desk",
  "reports_desk",
  "delivery_desk",
  "consignment_desk",
  "help_desk",
  "poolwise_desk",
] as const;

export type DeskCode = (typeof DESK_CODES)[number];

export const DESK_PERMISSION_KEY_BY_CODE: Record<DeskCode, string> = {
  sysadmin_desk: "desk.sysadmin.access",
  executive_desk: "desk.executive.access",
  branch_desk: "desk.branch.access",
  inventory_desk: "desk.inventory.access",
  pos_desk: "desk.pos.access",
  procurement_desk: "desk.procurement.access",
  finance_desk: "desk.finance.access",
  reports_desk: "desk.reports.access",
  delivery_desk: "desk.delivery.access",
  consignment_desk: "desk.consignment.access",
  help_desk: "desk.help.access",
  poolwise_desk: "desk.poolwise.access",
};

export const DEFAULT_CRITICAL_PERMISSION_KEYS = new Set<string>([
  "finance.period.reopen",
  "system.roles.manage",
  "system.roles.assign",
  "system.permissions.manage",
  "system.audit.export",
]);

