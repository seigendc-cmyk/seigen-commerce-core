import type { StaffMember } from "@/modules/dashboard/settings/staff/staff-types";
import type { VendorRoleRow } from "@/modules/dashboard/settings/roles/vendor-roles-context";
import { getOverridesForStaff } from "@/modules/dashboard/settings/roles/user-permission-overrides-store";

export function effectivePermissionCodes(input: {
  staff: StaffMember;
  role: VendorRoleRow | null;
}): string[] {
  const roleCodes = input.role?.permissionCodes ?? [];
  const ov = getOverridesForStaff(input.staff.id);
  const set = new Set<string>(roleCodes);
  for (const d of ov.deny) set.delete(d);
  for (const a of ov.allow) set.add(a);
  return Array.from(set);
}

