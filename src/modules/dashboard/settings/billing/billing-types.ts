export type VendorInvoiceRow = {
  id: string;
  tenant_id: string;
  status: "open" | "paid" | "void";
  cycle_start: string | null;
  cycle_end: string | null;
  currency: string;
  subtotal_cents: number;
  total_cents: number;
  created_at: string;
  paid_at: string | null;
  notes: string | null;
};

export type VendorInvoiceLineRow = {
  id: string;
  invoice_id: string;
  line_kind: "subscription" | "signup" | "feature_addon" | "adjustment";
  description: string;
  feature_key: string | null;
  amount_cents: number;
  meta: Record<string, unknown>;
  created_at: string;
};

export type BillingPendingFeatureRow = {
  id: string;
  tenant_id: string;
  feature_key: string;
  label: string;
  amount_cents: number;
  status: "pending" | "accepted" | "declined" | "invoiced" | "activated";
  created_at: string;
  responded_at: string | null;
  invoice_line_id: string | null;
};

export type BillingPlanCatalogRow = {
  plan_id: string;
  display_name: string;
  monthly_amount_cents: number;
  currency: string;
  sort_order: number;
};

export type BillableFeatureRow = {
  feature_key: string;
  label: string;
  description: string | null;
  amount_cents: number;
  billing_kind: "recurring_monthly" | "one_time";
  active: boolean;
};

export type BillingDashboardPayload = {
  ok: true;
  tenantId: string;
  currentPlanId: string | null;
  plans: Array<{
    planId: string;
    displayName: string;
    monthlyAmountCents: number;
    currency: string;
    /** From static catalog copy */
    purpose: string;
    tagline: string;
    highlights: string[];
    isCurrent: boolean;
  }>;
  billableCatalog: BillableFeatureRow[];
  invoices: VendorInvoiceRow[];
  linesByInvoiceId: Record<string, VendorInvoiceLineRow[]>;
  pending: BillingPendingFeatureRow[];
  paidAddonKeys: string[];
};

export type BillingDashboardUnavailable = {
  ok: false;
  reason: "not_configured" | "not_signed_in" | "no_workspace";
  message: string;
};
