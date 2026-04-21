"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { allMenuIds } from "./dashboard-menu-permissions";
import type { DashboardMenuPermissionId } from "./dashboard-menu-permissions";
import { readVendorCore, writeVendorCore } from "@/modules/dashboard/settings/vendor-core-storage";
import { ensureSysAdminRole } from "@/modules/desk/services/sysadmin-bootstrap";
import type { DeskKind } from "@/modules/desk/types/desk-profile";
import { allPermissionCodes } from "@/modules/dashboard/settings/roles/permission-catalog";

export type VendorRoleRow = {
  id: string;
  name: string;
  description: string;
  allowedMenuIds: DashboardMenuPermissionId[];
  /** Full permission keys (RBAC foundation). */
  permissionCodes?: string[];
  /** Optional desk controls (backward compatible). */
  deskEnabled?: boolean;
  terminalOnly?: boolean;
  deskKind?: DeskKind;
};

function newRoleRow(): VendorRoleRow {
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `role_${Date.now()}`,
    name: "",
    description: "",
    allowedMenuIds: [...allMenuIds()],
    permissionCodes: [],
  };
}

const DEFAULT_VENDOR_ROLES: VendorRoleRow[] = [
  {
    id: "preset-cashier",
    name: "Cashier",
    description: "Checkout and daily sales; no settings or catalog edits.",
    allowedMenuIds: ["overview", "pos"],
    permissionCodes: ["desk.access_pos_desk", "pos.make_sale", "pos.view_all_sales"],
    terminalOnly: true,
    deskEnabled: false,
  },
  {
    id: "preset-manager",
    name: "Manager",
    description: "Full vendor shell except destructive admin actions.",
    allowedMenuIds: [...allMenuIds()],
    permissionCodes: [
      "desk.access_vendor_desk",
      "desk.access_inventory_desk",
      "desk.access_pos_desk",
      "desk.access_finance_desk",
      "desk.access_consignment_desk",
      "desk.access_poolwise_desk",
      "desk.access_reports_desk",
      "inventory.create_product",
      "inventory.edit_product",
      "inventory.receive_stock",
      "inventory.stock_adjustment.post",
      "pos.make_sale",
      "pos.view_all_sales",
      "finance.view_dashboard",
      "cashplan.manage_reserves",
      "approvals.create_request",
      "approvals.approve_low_risk",
    ],
    terminalOnly: false,
    deskEnabled: true,
    deskKind: "management",
  },
];

type VendorRolesContextValue = {
  roles: VendorRoleRow[];
  updateRole: (id: string, patch: Partial<Omit<VendorRoleRow, "id">>) => void;
  /** Returns the new role id. */
  addRole: () => string;
  removeRole: (id: string) => void;
};

const VendorRolesContext = createContext<VendorRolesContextValue | null>(null);

export function VendorRolesProvider({ children }: { children: ReactNode }) {
  const [roles, setRoles] = useState<VendorRoleRow[]>(() => {
    const stored = readVendorCore<VendorRoleRow[]>("roles", []);
    const seeded = stored.length > 0 ? stored : [...DEFAULT_VENDOR_ROLES];
    const withSys = ensureSysAdminRole(seeded as any) as VendorRoleRow[];
    const allCodes = allPermissionCodes();
    const normalized = withSys.map((r) => {
      // Ensure permissionCodes exists; sysadmin gets all codes by default.
      if (r.id === "preset-sysadmin") {
        return { ...r, permissionCodes: allCodes };
      }
      return { ...r, permissionCodes: Array.isArray(r.permissionCodes) ? r.permissionCodes : [] };
    });
    if (stored.length === 0) writeVendorCore("roles", normalized);
    return normalized;
  });

  useEffect(() => {
    writeVendorCore("roles", roles);
  }, [roles]);

  const updateRole = useCallback((id: string, patch: Partial<Omit<VendorRoleRow, "id">>) => {
    setRoles((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const addRole = useCallback((): string => {
    const row = newRoleRow();
    setRoles((rows) => [...rows, row]);
    return row.id;
  }, []);

  const removeRole = useCallback((id: string) => {
    setRoles((rows) => {
      if (rows.length <= 1) return rows;
      return rows.filter((r) => r.id !== id);
    });
  }, []);

  const value = useMemo(
    () => ({
      roles,
      updateRole,
      addRole,
      removeRole,
    }),
    [roles, updateRole, addRole, removeRole],
  );

  return <VendorRolesContext.Provider value={value}>{children}</VendorRolesContext.Provider>;
}

export function useVendorRoles(): VendorRolesContextValue {
  const ctx = useContext(VendorRolesContext);
  if (!ctx) {
    throw new Error("useVendorRoles must be used within VendorRolesProvider");
  }
  return ctx;
}

/** For optional linking (e.g. marketing pages) without throwing. */
export function useVendorRolesOptional(): VendorRolesContextValue | null {
  return useContext(VendorRolesContext);
}
