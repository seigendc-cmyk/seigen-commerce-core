export const RBAC_RISK_LEVELS = ["low", "medium", "high", "critical"] as const;
export type RbacRiskLevel = (typeof RBAC_RISK_LEVELS)[number];

export const RBAC_SCOPE_TYPES = ["tenant", "branch", "warehouse", "terminal", "desk"] as const;
export type RbacScopeType = (typeof RBAC_SCOPE_TYPES)[number];

export const RBAC_OVERRIDE_TYPES = ["grant", "deny"] as const;
export type RbacOverrideType = (typeof RBAC_OVERRIDE_TYPES)[number];

export const RBAC_ACCESS_LEVELS = ["allowed", "denied", "read_only"] as const;
export type RbacAccessLevel = (typeof RBAC_ACCESS_LEVELS)[number];

export const SYSTEM_ROLE_CODES = [
  "sys_admin",
  "owner",
  "director",
  "general_manager",
  "branch_manager",
  "store_supervisor",
  "cashier",
  "inventory_clerk",
  "accountant",
  "procurement_officer",
  "warehouse_officer",
  "dispatch_officer",
  "customer_service",
  "auditor",
  "read_only_analyst",
] as const;

export type SystemRoleCode = (typeof SYSTEM_ROLE_CODES)[number];

export const PROTECTED_SYSTEM_ROLE_CODES: SystemRoleCode[] = ["sys_admin"];

