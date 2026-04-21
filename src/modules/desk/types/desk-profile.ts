export type DeskKind =
  | "sysadmin"
  | "management"
  | "supervisor"
  | "finance"
  | "inventory"
  | "sales-supervisor"
  | "operations"
  | "custom";

export type DeskBranchScope = "all" | string[];

export type StaffDeskProfile = {
  id: string;
  staffId: string;
  tenantId?: string | null;
  branchScope: DeskBranchScope;
  roleId: string;
  roleNameSnapshot: string;
  hasDesk: boolean;
  deskKind: DeskKind;
  isTerminalOnly: boolean;
  createdAt: string;
  updatedAt: string;
};

