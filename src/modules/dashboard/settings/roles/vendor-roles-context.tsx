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

/** Shared baseline for branch operations leads (Manager + Store Controller). */
const MANAGER_PERMISSION_CODES: string[] = [
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
];

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
    id: "preset-shop-supervisor",
    name: "Shop Supervisor",
    description: "Floor lead: sales, receiving, and low-risk approvals; no billing or role administration.",
    allowedMenuIds: [
      "overview",
      "desk",
      "inventory",
      "pos",
      "financial",
      "poolwise",
      "cash-plan",
      "reports",
      "brain",
      "bi-rules",
    ],
    permissionCodes: [
      "desk.access_vendor_desk",
      "desk.access_inventory_desk",
      "desk.access_pos_desk",
      "desk.access_finance_desk",
      "desk.access_reports_desk",
      "inventory.create_product",
      "inventory.edit_product",
      "inventory.receive_stock",
      "pos.make_sale",
      "pos.view_all_sales",
      "pos.void_sale",
      "pos.process_return",
      "finance.view_dashboard",
      "reports.view",
      "approvals.create_request",
      "approvals.approve_low_risk",
    ],
    terminalOnly: false,
    deskEnabled: true,
    deskKind: "supervisor",
  },
  {
    id: "preset-loss-control",
    name: "Loss Control",
    description: "Audit, exports, and cross-channel visibility for shrinkage and exceptions.",
    allowedMenuIds: [
      "overview",
      "desk",
      "inventory",
      "pos",
      "financial",
      "consignment",
      "reports",
      "brain",
      "bi-rules",
      "settings",
    ],
    permissionCodes: [
      "system.access_sysadmin_desk",
      "desk.access_vendor_desk",
      "desk.access_inventory_desk",
      "desk.access_pos_desk",
      "desk.access_finance_desk",
      "desk.access_reports_desk",
      "finance.view_dashboard",
      "pos.view_all_sales",
      "inventory.receive_stock",
      "reports.view",
      "reports.export",
      "security.view_audit",
      "security.export_audit",
      "approvals.create_request",
    ],
    terminalOnly: false,
    deskEnabled: true,
    deskKind: "operations",
  },
  {
    id: "preset-store-controller",
    name: "Store Controller",
    description: "Store-wide control: same operational scope as Manager plus executive oversight and reporting exports.",
    allowedMenuIds: [...allMenuIds()],
    permissionCodes: [
      ...MANAGER_PERMISSION_CODES,
      "desk.access_executive_desk",
      "reports.view",
      "reports.export",
      "pos.void_sale",
      "pos.process_return",
    ],
    terminalOnly: false,
    deskEnabled: true,
    deskKind: "operations",
  },
  {
    id: "preset-manager",
    name: "Manager",
    description: "Full vendor shell except destructive admin actions.",
    allowedMenuIds: [...allMenuIds()],
    permissionCodes: [...MANAGER_PERMISSION_CODES],
    terminalOnly: false,
    deskEnabled: true,
    deskKind: "management",
  },
  {
    id: "preset-owner",
    name: "Owner",
    description: "Business owner with the same effective access as SysAdmin for permissions and navigation.",
    allowedMenuIds: [...allMenuIds()],
    permissionCodes: [],
    terminalOnly: false,
    deskEnabled: true,
    deskKind: "management",
  },
];

function mergeMissingPresetRoles(stored: VendorRoleRow[], presets: VendorRoleRow[]): VendorRoleRow[] {
  const seen = new Set(stored.map((r) => r.id));
  const merged = [...stored];
  for (const p of presets) {
    if (!seen.has(p.id)) {
      merged.push({ ...p });
      seen.add(p.id);
    }
  }
  return merged;
}

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
    const seededBase = stored.length > 0 ? mergeMissingPresetRoles(stored, DEFAULT_VENDOR_ROLES) : [...DEFAULT_VENDOR_ROLES];
    const withSys = ensureSysAdminRole(seededBase as any) as VendorRoleRow[];
    const allCodes = allPermissionCodes();
    const menuIds = allMenuIds();
    const normalized = withSys.map((r) => {
      // Full-access templates: always carry the full catalog and every sidebar key.
      if (r.id === "preset-sysadmin" || r.id === "preset-owner") {
        return {
          ...r,
          permissionCodes: allCodes,
          allowedMenuIds: [...menuIds],
        };
      }
      return { ...r, permissionCodes: Array.isArray(r.permissionCodes) ? r.permissionCodes : [] };
    });
    const shouldPersistSeed = stored.length === 0 || mergeMissingPresetRoles(stored, DEFAULT_VENDOR_ROLES).length !== stored.length;
    if (shouldPersistSeed) writeVendorCore("roles", normalized);
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
    if (id.startsWith("preset-")) return;
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
