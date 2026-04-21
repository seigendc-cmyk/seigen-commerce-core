import { readDeskDb, writeDeskDb } from "@/modules/desk/services/desk-storage";
import { upsertDeskProfile } from "@/modules/desk/services/desk-profiles-store";
import type { StaffMember } from "@/modules/dashboard/settings/staff/staff-types";
import type { VendorRoleRow } from "@/modules/dashboard/settings/roles/vendor-roles-context";
import { computeDeskEligibilityForRole } from "@/modules/desk/services/desk-eligibility";

export const SYSADMIN_ROLE_ID = "preset-sysadmin";
export const SYSADMIN_STAFF_ID = "preset-sysadmin-staff";
/** seiGEN Commerce support — same governance role as vendor SysAdmin for Pack 2 desk access. */
export const SEIGEN_SUPPORT_STAFF_ID = "preset-seigen-support-staff";

export function ensureSysAdminRole(existing: VendorRoleRow[]): VendorRoleRow[] {
  if (existing.some((r) => r.id === SYSADMIN_ROLE_ID)) return existing;
  const sys: VendorRoleRow & { deskEnabled?: boolean; terminalOnly?: boolean; deskKind?: "sysadmin" } = {
    id: SYSADMIN_ROLE_ID,
    name: "SysAdmin",
    description: "System administrator with full access and approval authority.",
    allowedMenuIds: Array.from(new Set(existing.flatMap((r) => r.allowedMenuIds))) as any,
    deskEnabled: true,
    terminalOnly: false,
    deskKind: "sysadmin",
  };
  return [sys, ...existing];
}

export function ensureSysAdminStaff(existing: StaffMember[], branchId: string): StaffMember[] {
  if (existing.some((s) => s.id === SYSADMIN_STAFF_ID)) return existing;
  const row: StaffMember = {
    id: SYSADMIN_STAFF_ID,
    firstName: "Sys",
    lastName: "Admin",
    dateOfBirth: "",
    employeeId: "SYSADMIN",
    passportFrontWebp: null,
    passportBackWebp: null,
    email: "sysadmin@local",
    phone: "",
    alternatePhone: "",
    contactAddress: "",
    branchId,
    assignedRoleId: SYSADMIN_ROLE_ID,
    duties: "System administration, roles, permissions, approvals, audit.",
    previousJobs: [],
    activityLog: [],
  };
  return [row, ...existing];
}

export function ensureSeigenSupportStaff(existing: StaffMember[], branchId: string): StaffMember[] {
  if (existing.some((s) => s.id === SEIGEN_SUPPORT_STAFF_ID)) return existing;
  const row: StaffMember = {
    id: SEIGEN_SUPPORT_STAFF_ID,
    firstName: "seiGEN",
    lastName: "Support",
    dateOfBirth: "",
    employeeId: "SEIGEN-SUPPORT",
    passportFrontWebp: null,
    passportBackWebp: null,
    email: "support@seigencommerce.com",
    phone: "",
    alternatePhone: "",
    contactAddress: "",
    branchId,
    assignedRoleId: SYSADMIN_ROLE_ID,
    duties: "seiGEN Commerce vendor support — SysAdmin desk access with support startup credentials.",
    previousJobs: [],
    activityLog: [],
  };
  return [row, ...existing];
}

/**
 * Persisted “active staff” selector for the dashboard surface (local-first).
 * Later this can map to Supabase auth user id.
 */
export function getActiveStaffId(): string | null {
  const db = readDeskDb<{ activeStaffId: string | null }>("desk_active_staff", { activeStaffId: null });
  return db.activeStaffId ?? null;
}

export function setActiveStaffId(staffId: string | null) {
  writeDeskDb("desk_active_staff", { activeStaffId: staffId });
}

export function ensureSysAdminDeskProfile(input: {
  staffId: string;
  roleId: string;
  roleName: string;
  branchId: string;
}) {
  const elig = computeDeskEligibilityForRole({
    id: input.roleId,
    name: input.roleName,
    description: "",
    allowedMenuIds: ["overview"] as any,
    deskEnabled: true,
    terminalOnly: false,
    deskKind: "sysadmin",
  } as any);
  upsertDeskProfile({
    staffId: input.staffId,
    tenantId: null,
    branchScope: "all",
    roleId: input.roleId,
    roleNameSnapshot: input.roleName,
    hasDesk: elig.hasDesk,
    deskKind: elig.deskKind,
    isTerminalOnly: elig.isTerminalOnly,
  });
}

