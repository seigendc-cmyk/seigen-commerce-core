/**
 * Menu keys for RBAC — aligned with `DashboardSidebar` routes.
 * Enforcement (RLS / middleware) comes later; UI and role builder use these ids first.
 */
export const DASHBOARD_MENU_PERMISSIONS = [
  {
    id: "overview",
    label: "Overview",
    href: "/dashboard",
    description: "Home dashboard and plan summary",
  },
  {
    id: "inventory",
    label: "Inventory",
    href: "/dashboard/inventory",
    description: "Catalog, stock, receiving, purchasing",
  },
  {
    id: "pos",
    label: "Point of sale",
    href: "/dashboard/pos",
    description: "Registers, checkout, receipts",
  },
  {
    id: "poolwise",
    label: "PoolWise",
    href: "/dashboard/poolwise",
    description: "Collaborative pools, market space, contributions, allocation",
  },
  {
    id: "bi-rules",
    label: "BI rules",
    href: "/dashboard/bi/rules",
    description: "Business rules and routable policies for modules",
  },
  {
    id: "settings",
    label: "Settings",
    href: "/dashboard/settings",
    description: "Business profile, staff, branches, roles",
  },
] as const;

export type DashboardMenuPermissionId = (typeof DASHBOARD_MENU_PERMISSIONS)[number]["id"];

export function allMenuIds(): DashboardMenuPermissionId[] {
  return DASHBOARD_MENU_PERMISSIONS.map((m) => m.id);
}
