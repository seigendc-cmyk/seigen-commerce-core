export type PermissionRisk = "low" | "medium" | "high" | "critical";

export type PermissionCategoryId =
  | "system"
  | "desk"
  | "staff"
  | "pos"
  | "inventory"
  | "procurement"
  | "finance"
  | "approvals"
  | "reports"
  | "market"
  | "delivery"
  | "consignment"
  | "security";

export type PermissionDef = {
  code: string;
  categoryId: PermissionCategoryId;
  label: string;
  description: string;
  risk: PermissionRisk;
  moduleKeys: string[];
  /** Parent permissions required for this permission to be meaningful. */
  parents?: string[];
  /** When true, changes should be audited as sensitive. */
  sensitive?: boolean;
};

export const PERMISSION_CATEGORIES: Array<{ id: PermissionCategoryId; label: string }> = [
  { id: "system", label: "System" },
  { id: "desk", label: "Desk access" },
  { id: "staff", label: "Staff & HR" },
  { id: "pos", label: "POS & Sales" },
  { id: "inventory", label: "Inventory" },
  { id: "procurement", label: "Procurement" },
  { id: "finance", label: "Finance & CashPlan" },
  { id: "approvals", label: "Approvals & Governance" },
  { id: "reports", label: "Reports & Analytics" },
  { id: "market", label: "Market / Storefront" },
  { id: "delivery", label: "Delivery / Logistics" },
  { id: "consignment", label: "Consignment" },
  { id: "security", label: "Audit & Security" },
];

const P = (d: PermissionDef) => d;

export const PERMISSIONS: PermissionDef[] = [
  // System administration
  P({
    code: "system.access_sysadmin_desk",
    categoryId: "system",
    label: "Access SysAdmin Desk",
    description: "Enter SysAdmin desk and global governance tooling.",
    risk: "critical",
    moduleKeys: ["desk", "settings"],
    sensitive: true,
  }),
  P({
    code: "system.manage_branches",
    categoryId: "system",
    label: "Manage branches",
    description: "Create/edit/remove branches and branch metadata.",
    risk: "high",
    moduleKeys: ["settings"],
    parents: ["system.access_sysadmin_desk"],
    sensitive: true,
  }),
  P({
    code: "system.manage_staff_accounts",
    categoryId: "system",
    label: "Manage staff accounts",
    description: "Create/edit/deactivate staff accounts.",
    risk: "critical",
    moduleKeys: ["settings"],
    parents: ["system.access_sysadmin_desk"],
    sensitive: true,
  }),
  P({
    code: "system.assign_roles",
    categoryId: "system",
    label: "Assign roles",
    description: "Assign roles to staff members.",
    risk: "critical",
    moduleKeys: ["settings"],
    parents: ["system.manage_staff_accounts"],
    sensitive: true,
  }),
  P({
    code: "system.manage_billing",
    categoryId: "system",
    label: "Manage billing & activation",
    description: "Activation codes, plans, subscriptions and billing settings.",
    risk: "critical",
    moduleKeys: ["settings", "console"],
    parents: ["system.access_sysadmin_desk"],
    sensitive: true,
  }),

  // Desk access
  P({
    code: "desk.access_vendor_desk",
    categoryId: "desk",
    label: "Access Branch/Management Desk",
    description: "Access vendor desk (notifications/approvals) scoped by role and branch.",
    risk: "low",
    moduleKeys: ["desk"],
  }),
  P({
    code: "desk.access_executive_desk",
    categoryId: "desk",
    label: "Access Executive Desk",
    description: "Access executive governance overview surface.",
    risk: "medium",
    moduleKeys: ["executive"],
  }),
  P({
    code: "desk.access_inventory_desk",
    categoryId: "desk",
    label: "Access Inventory Desk",
    description: "Access inventory oversight surfaces and tools.",
    risk: "low",
    moduleKeys: ["inventory"],
  }),
  P({
    code: "desk.access_pos_desk",
    categoryId: "desk",
    label: "Access POS Desk",
    description: "Access POS terminal and sales tools.",
    risk: "low",
    moduleKeys: ["pos"],
  }),
  P({
    code: "desk.access_finance_desk",
    categoryId: "desk",
    label: "Access Finance Desk",
    description: "Access financial dashboard and cash-plan tools.",
    risk: "medium",
    moduleKeys: ["financial", "cashplan"],
  }),
  P({
    code: "desk.access_poolwise_desk",
    categoryId: "desk",
    label: "Access PoolWise Desk",
    description: "Access PoolWise collaboration desk.",
    risk: "medium",
    moduleKeys: ["poolwise"],
  }),
  P({
    code: "desk.access_consignment_desk",
    categoryId: "desk",
    label: "Access Consignment Desk",
    description: "Access consignment operations and governance tools.",
    risk: "medium",
    moduleKeys: ["consignment"],
  }),
  P({
    code: "desk.access_reports_desk",
    categoryId: "desk",
    label: "Access Reports Desk",
    description: "Access reporting surfaces and exports.",
    risk: "medium",
    moduleKeys: ["reports"],
  }),

  // Staff & HR control
  P({
    code: "staff.add",
    categoryId: "staff",
    label: "Add staff",
    description: "Create staff records.",
    risk: "high",
    moduleKeys: ["settings"],
    parents: ["system.manage_staff_accounts"],
    sensitive: true,
  }),
  P({
    code: "staff.edit",
    categoryId: "staff",
    label: "Edit staff",
    description: "Edit staff records and HR notes.",
    risk: "high",
    moduleKeys: ["settings"],
    parents: ["system.manage_staff_accounts"],
    sensitive: true,
  }),
  P({
    code: "staff.remove",
    categoryId: "staff",
    label: "Remove staff",
    description: "Remove staff records (where supported).",
    risk: "critical",
    moduleKeys: ["settings"],
    parents: ["system.manage_staff_accounts"],
    sensitive: true,
  }),
  P({
    code: "staff.view_activity_logs",
    categoryId: "staff",
    label: "View attendance/activity logs",
    description: "View staff activity/incident logs.",
    risk: "medium",
    moduleKeys: ["settings"],
    parents: ["system.manage_staff_accounts"],
  }),

  // POS & Sales (subset; can be expanded)
  P({
    code: "pos.make_sale",
    categoryId: "pos",
    label: "Make sale",
    description: "Complete POS sale / receipt.",
    risk: "low",
    moduleKeys: ["pos"],
    parents: ["desk.access_pos_desk"],
  }),
  P({
    code: "pos.void_sale",
    categoryId: "pos",
    label: "Void full sale",
    description: "Void an entire sale/receipt.",
    risk: "high",
    moduleKeys: ["pos"],
    parents: ["desk.access_pos_desk"],
    sensitive: true,
  }),
  P({
    code: "pos.process_return",
    categoryId: "pos",
    label: "Process return",
    description: "Process returns/partial returns.",
    risk: "high",
    moduleKeys: ["pos"],
    parents: ["desk.access_pos_desk"],
    sensitive: true,
  }),
  P({
    code: "pos.override_price",
    categoryId: "pos",
    label: "Override price floor / change selling price",
    description: "Override pricing rules at sale time.",
    risk: "critical",
    moduleKeys: ["pos"],
    parents: ["desk.access_pos_desk"],
    sensitive: true,
  }),
  P({
    code: "pos.view_all_sales",
    categoryId: "pos",
    label: "View all sales",
    description: "View sales across staff/terminals.",
    risk: "medium",
    moduleKeys: ["pos"],
    parents: ["desk.access_pos_desk"],
  }),

  // Inventory (subset)
  P({
    code: "inventory.create_product",
    categoryId: "inventory",
    label: "Create product",
    description: "Create new products in catalog.",
    risk: "medium",
    moduleKeys: ["inventory"],
    parents: ["desk.access_inventory_desk"],
  }),
  P({
    code: "inventory.edit_product",
    categoryId: "inventory",
    label: "Edit product",
    description: "Edit product catalog fields.",
    risk: "medium",
    moduleKeys: ["inventory"],
    parents: ["desk.access_inventory_desk"],
  }),
  P({
    code: "inventory.delete_product",
    categoryId: "inventory",
    label: "Delete product",
    description: "Delete products (governed).",
    risk: "critical",
    moduleKeys: ["inventory"],
    parents: ["desk.access_inventory_desk"],
    sensitive: true,
  }),
  P({
    code: "inventory.stock_adjustment.post",
    categoryId: "inventory",
    label: "Post stock count variance / adjustments",
    description: "Post stock variances and adjustments.",
    risk: "high",
    moduleKeys: ["inventory", "financial"],
    parents: ["desk.access_inventory_desk"],
    sensitive: true,
  }),
  P({
    code: "inventory.receive_stock",
    categoryId: "inventory",
    label: "Receive stock",
    description: "Receive goods and update inventory.",
    risk: "medium",
    moduleKeys: ["inventory"],
    parents: ["desk.access_inventory_desk"],
  }),

  // Finance & CashPlan (subset)
  P({
    code: "finance.view_dashboard",
    categoryId: "finance",
    label: "View financial dashboard",
    description: "Access financial KPIs and ledgers.",
    risk: "medium",
    moduleKeys: ["financial"],
    parents: ["desk.access_finance_desk"],
  }),
  P({
    code: "finance.post_journal",
    categoryId: "finance",
    label: "Post journal",
    description: "Post general journal entries.",
    risk: "high",
    moduleKeys: ["financial"],
    parents: ["desk.access_finance_desk"],
    sensitive: true,
  }),
  P({
    code: "cashplan.manage_reserves",
    categoryId: "finance",
    label: "Manage reserve accounts",
    description: "Create/fund/withdraw reserves (approval may apply).",
    risk: "high",
    moduleKeys: ["cashplan"],
    parents: ["desk.access_finance_desk"],
    sensitive: true,
  }),

  // Approvals & governance
  P({
    code: "approvals.create_request",
    categoryId: "approvals",
    label: "Create approval request",
    description: "Initiate approval requests for governed actions.",
    risk: "medium",
    moduleKeys: ["desk"],
    parents: ["desk.access_vendor_desk"],
  }),
  P({
    code: "approvals.approve_low_risk",
    categoryId: "approvals",
    label: "Approve low-risk actions",
    description: "Approve low-risk requests per policy.",
    risk: "high",
    moduleKeys: ["desk"],
    parents: ["desk.access_vendor_desk"],
    sensitive: true,
  }),
  P({
    code: "approvals.approve_high_risk",
    categoryId: "approvals",
    label: "Approve high-risk actions",
    description: "Approve high/critical requests per policy.",
    risk: "critical",
    moduleKeys: ["desk"],
    parents: ["desk.access_vendor_desk"],
    sensitive: true,
  }),
  P({
    code: "approvals.override_chain",
    categoryId: "approvals",
    label: "Override approval chain",
    description: "Override or re-route approval chain.",
    risk: "critical",
    moduleKeys: ["desk"],
    parents: ["system.access_sysadmin_desk"],
    sensitive: true,
  }),

  // Reports & analytics
  P({
    code: "reports.view",
    categoryId: "reports",
    label: "View reports",
    description: "View reports dashboards.",
    risk: "low",
    moduleKeys: ["reports"],
    parents: ["desk.access_reports_desk"],
  }),
  P({
    code: "reports.export",
    categoryId: "reports",
    label: "Export reports",
    description: "Export reports to files.",
    risk: "high",
    moduleKeys: ["reports"],
    parents: ["desk.access_reports_desk"],
    sensitive: true,
  }),

  // Consignment
  P({
    code: "consignment.create_agreement",
    categoryId: "consignment",
    label: "Create consignment agreement",
    description: "Create consignment agreement drafts and submit for approval.",
    risk: "high",
    moduleKeys: ["consignment"],
    parents: ["desk.access_consignment_desk"],
  }),
  P({
    code: "consignment.approve_settlement",
    categoryId: "consignment",
    label: "Approve consignment settlement",
    description: "Approve consignment settlements and close cycles.",
    risk: "high",
    moduleKeys: ["consignment"],
    parents: ["desk.access_consignment_desk", "approvals.approve_low_risk"],
  }),
  P({
    code: "consignment.issue_invoice.create",
    categoryId: "consignment",
    label: "Create consignment issue invoices",
    description: "Draft and submit consignment issue invoices from principal warehouse to agent stalls.",
    risk: "high",
    moduleKeys: ["consignment"],
    parents: ["desk.access_consignment_desk"],
  }),
  P({
    code: "consignment.issue_invoice.approve",
    categoryId: "consignment",
    label: "Approve consignment issue invoices",
    description: "Approve or reject formal stock issues before agent trading stock is released.",
    risk: "high",
    moduleKeys: ["consignment"],
    parents: ["desk.access_consignment_desk", "approvals.approve_low_risk"],
  }),

  // Audit & security
  P({
    code: "security.view_audit",
    categoryId: "security",
    label: "View audit trail",
    description: "View desk audit trail and governance events.",
    risk: "high",
    moduleKeys: ["desk", "brain"],
    parents: ["system.access_sysadmin_desk"],
    sensitive: true,
  }),
  P({
    code: "security.export_audit",
    categoryId: "security",
    label: "Export audit logs",
    description: "Export audit logs for compliance.",
    risk: "critical",
    moduleKeys: ["desk", "brain"],
    parents: ["security.view_audit"],
    sensitive: true,
  }),
];

export function listPermissionsByCategory(): Map<PermissionCategoryId, PermissionDef[]> {
  const m = new Map<PermissionCategoryId, PermissionDef[]>();
  for (const c of PERMISSION_CATEGORIES) m.set(c.id, []);
  for (const p of PERMISSIONS) {
    const arr = m.get(p.categoryId) ?? [];
    arr.push(p);
    m.set(p.categoryId, arr);
  }
  for (const [k, arr] of m.entries()) {
    arr.sort((a, b) => a.label.localeCompare(b.label));
    m.set(k, arr);
  }
  return m;
}

export function allPermissionCodes(): string[] {
  return PERMISSIONS.map((p) => p.code);
}

