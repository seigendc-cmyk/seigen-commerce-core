"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { allMenuIds } from "./dashboard-menu-permissions";
import type { DashboardMenuPermissionId } from "./dashboard-menu-permissions";

export type VendorRoleRow = {
  id: string;
  name: string;
  description: string;
  allowedMenuIds: DashboardMenuPermissionId[];
};

function newRoleRow(): VendorRoleRow {
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `role_${Date.now()}`,
    name: "",
    description: "",
    allowedMenuIds: [...allMenuIds()],
  };
}

const DEFAULT_VENDOR_ROLES: VendorRoleRow[] = [
  {
    id: "preset-cashier",
    name: "Cashier",
    description: "Checkout and daily sales; no settings or catalog edits.",
    allowedMenuIds: ["overview", "pos"],
  },
  {
    id: "preset-manager",
    name: "Manager",
    description: "Full vendor shell except destructive admin actions.",
    allowedMenuIds: [...allMenuIds()],
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
  const [roles, setRoles] = useState<VendorRoleRow[]>(() => [...DEFAULT_VENDOR_ROLES]);

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
