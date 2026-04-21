"use client";

import type { ReactNode } from "react";
import { VendorBranchesProvider } from "@/modules/dashboard/settings/branches/vendor-branches-context";
import { VendorRolesProvider } from "@/modules/dashboard/settings/roles/vendor-roles-context";
import { VendorStaffProvider } from "@/modules/dashboard/settings/staff/vendor-staff-context";

export function VendorCoreProviders({ children }: { children: ReactNode }) {
  return (
    <VendorRolesProvider>
      <VendorBranchesProvider>
        <VendorStaffProvider>{children}</VendorStaffProvider>
      </VendorBranchesProvider>
    </VendorRolesProvider>
  );
}

