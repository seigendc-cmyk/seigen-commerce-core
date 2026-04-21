import type { VendorRoleRow } from "@/modules/dashboard/settings/roles/vendor-roles-context";
import type { DeskKind } from "@/modules/desk/types/desk-profile";

export type DeskEligibilityResult = {
  hasDesk: boolean;
  isTerminalOnly: boolean;
  deskKind: DeskKind;
};

function norm(s: string): string {
  return (s || "").trim().toLowerCase();
}

function includesAny(hay: string, needles: string[]): boolean {
  return needles.some((n) => hay.includes(n));
}

export function computeDeskEligibilityForRole(role: VendorRoleRow | null | undefined): DeskEligibilityResult {
  if (!role) {
    return { hasDesk: false, isTerminalOnly: false, deskKind: "custom" };
  }

  // Optional explicit overrides (backward compatible).
  const anyRole = role as VendorRoleRow & {
    deskEnabled?: boolean;
    terminalOnly?: boolean;
    deskKind?: DeskKind;
  };

  if (anyRole.terminalOnly === true) {
    return { hasDesk: false, isTerminalOnly: true, deskKind: "custom" };
  }
  if (anyRole.deskEnabled === true) {
    return { hasDesk: true, isTerminalOnly: false, deskKind: anyRole.deskKind ?? "management" };
  }

  const name = norm(role.name);
  const desc = norm(role.description);
  const blob = `${name} ${desc}`;

  // Terminal-only defaults
  if (includesAny(blob, ["cashier", "till", "terminal", "pos operator", "checkout"])) {
    return { hasDesk: false, isTerminalOnly: true, deskKind: "custom" };
  }

  // Desk-enabled defaults (management/ops)
  if (includesAny(blob, ["sysadmin", "system admin"])) {
    return { hasDesk: true, isTerminalOnly: false, deskKind: "sysadmin" };
  }
  if (includesAny(blob, ["owner", "admin", "manager", "supervisor", "operations"])) {
    return { hasDesk: true, isTerminalOnly: false, deskKind: "management" };
  }
  if (includesAny(blob, ["finance", "accounts", "accounting"])) {
    return { hasDesk: true, isTerminalOnly: false, deskKind: "finance" };
  }
  if (includesAny(blob, ["inventory", "stock", "purchasing", "procurement"])) {
    return { hasDesk: true, isTerminalOnly: false, deskKind: "inventory" };
  }

  // Default: no desk, not terminal-only.
  return { hasDesk: false, isTerminalOnly: false, deskKind: "custom" };
}

