/**
 * Menu keys for RBAC — aligned with `DashboardSidebar` routes.
 * Enforcement (RLS / middleware) comes later; UI and role builder use these ids first.
 */
export const DASHBOARD_MENU_PERMISSIONS = [
  {
    id: "desk",
    section: "Vendor shell",
    label: "Desk",
    href: "/dashboard/desk",
    description: "Approvals, notifications, and operational desk",
  },
  {
    id: "overview",
    section: "Vendor shell",
    label: "Overview",
    href: "/dashboard",
    description: "Home dashboard and plan summary",
  },
  {
    id: "inventory",
    section: "Commerce",
    label: "Inventory",
    href: "/dashboard/inventory",
    description: "Catalog, stock, receiving, purchasing",
  },
  {
    id: "pos",
    section: "Commerce",
    label: "Point of sale",
    href: "/dashboard/pos",
    description: "Registers, checkout, receipts",
  },
  {
    id: "financial",
    section: "Commerce",
    label: "Financial",
    href: "/dashboard/financial",
    description: "Ledgers, cash movement, and financial KPIs",
  },
  {
    id: "consignment",
    section: "Commerce",
    label: "Consignment",
    href: "/dashboard/consignment",
    description: "Consignment agreements, stock, and settlements",
  },
  {
    id: "poolwise",
    section: "Commerce",
    label: "PoolWise",
    href: "/dashboard/poolwise",
    description: "Collaborative pools, market space, contributions, allocation",
  },
  {
    id: "cash-plan",
    section: "Commerce",
    label: "CashPlan",
    href: "/dashboard/cash-plan",
    description: "Reserves and cash-plan tooling",
  },
  {
    id: "reports",
    section: "Intelligence",
    label: "Reports",
    href: "/dashboard/desk/security/governance/reports",
    description: "Governance and audit reporting surfaces",
  },
  {
    id: "brain",
    section: "Intelligence",
    label: "Brain",
    href: "/dashboard/brain",
    description: "Events, automations, and intelligence surfaces",
  },
  {
    id: "bi-rules",
    section: "Intelligence",
    label: "BI rules",
    href: "/dashboard/bi/rules",
    description: "Business rules and routable policies for modules",
  },
  {
    id: "settings",
    section: "Administration",
    label: "Settings",
    href: "/dashboard/settings",
    description: "Business profile, staff, branches, roles",
  },
] as const;

export type DashboardMenuPermissionId = (typeof DASHBOARD_MENU_PERMISSIONS)[number]["id"];

export function allMenuIds(): DashboardMenuPermissionId[] {
  return DASHBOARD_MENU_PERMISSIONS.map((m) => m.id);
}
