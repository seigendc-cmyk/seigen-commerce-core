/**
 * Commercial plans — seiGEN is priced as infrastructure progression, not “software tiers.”
 * IDs are stable for Supabase `tenant_subscriptions.plan_id` and `billing_plan_catalog.plan_id`.
 *
 * Legacy IDs from earlier catalog versions resolve via {@link resolvePlanId}.
 */

export type PlanId =
  | "free"
  | "starter"
  | "lite-shop"
  | "growth-pos"
  | "growth-plus"
  | "business"
  | "scale"
  | "enterprise";

/** Deprecated plan slugs still stored on old rows — map to canonical {@link PlanId}. */
export const LEGACY_PLAN_ID_MAP: Record<string, PlanId> = {
  "commerce-plus": "business",
  "multi-branch-retail": "business",
  distributor: "scale",
};

/**
 * Feature bundles for dashboard copy and route/module gating (local + server).
 * POS and full stock management unlock from `growth-pos` upward per current narrative.
 */
export const ALL_PLAN_MODULES = [
  "catalog_items",
  "inventory_stock",
  "pos_checkout",
  "pos_multi_register",
  "cash_plan",
  "online_storefront",
  "promotions",
  "staff_roles",
  "reporting_basic",
  "reporting_advanced",
  "multi_branch",
  "api_integrations",
  "wholesale_b2b",
  "account_manager",
] as const;

export type PlanModule = (typeof ALL_PLAN_MODULES)[number];

export const PLAN_MODULE_INFO: Record<PlanModule, { label: string; blurb: string }> = {
  catalog_items: {
    label: "Product catalog",
    blurb: "SKUs, units, cost and sell pricing, activation",
  },
  inventory_stock: {
    label: "Inventory & stock",
    blurb: "On-hand, receiving, purchasing, branch stock",
  },
  pos_checkout: {
    label: "Point of sale",
    blurb: "Checkout, tenders, local receipts",
  },
  pos_multi_register: {
    label: "Multi-register POS",
    blurb: "Extra lanes, shift-friendly operations",
  },
  cash_plan: {
    label: "CashPlan",
    blurb: "Supplier payables, debtor receivables, and laybye goods visibility",
  },
  online_storefront: {
    label: "Online storefront",
    blurb: "Customer-facing listings and checkout",
  },
  promotions: {
    label: "Promotions",
    blurb: "Deals, coupons, campaign hooks",
  },
  staff_roles: {
    label: "Staff & roles",
    blurb: "Role-based access for cashiers and managers",
  },
  reporting_basic: {
    label: "Standard reports",
    blurb: "Sales summaries and inventory snapshots",
  },
  reporting_advanced: {
    label: "Advanced analytics",
    blurb: "Deeper rollups, exports, operational KPIs",
  },
  multi_branch: {
    label: "Multi-branch",
    blurb: "Central catalog, transfers, branch rollups",
  },
  api_integrations: {
    label: "API & integrations",
    blurb: "Programmatic access and connector-ready hooks",
  },
  wholesale_b2b: {
    label: "Wholesale / B2B",
    blurb: "Tier pricing, bulk orders, partner workflows",
  },
  account_manager: {
    label: "Named success partner",
    blurb: "Dedicated onboarding and solution alignment",
  },
};

export type CommercialPlan = {
  id: PlanId;
  name: string;
  /** Display e.g. "~$4" or "Custom" */
  monthlyPriceLabel: string;
  /** USD cents — align with `billing_plan_catalog.monthly_amount_cents` */
  monthlyPriceCents: number;
  /**
   * Soft cap for verified catalogue items (enforced when catalog service checks limits).
   * `null` = no numeric cap at tier (enterprise negotiates separately).
   */
  catalogVerifiedItemCap: number | null;
  purpose: string;
  tagline: string;
  highlights: string[];
  audience: string;
  cta: string;
  featured?: boolean;
  includedModules: readonly PlanModule[];
};

export const PLANS: CommercialPlan[] = [
  {
    id: "free",
    name: "Free",
    monthlyPriceLabel: "$0",
    monthlyPriceCents: 0,
    catalogVerifiedItemCap: 40,
    purpose: "Entry into the system — marketplace density, not a time-limited trial.",
    tagline: "List a small verified catalogue, basic storefront visibility, and iTred discovery.",
    highlights: [
      "Limited verified catalogue (entry band)",
      "Basic storefront visibility & iTred discovery",
      "Manual / WhatsApp-style order handling",
      "No POS, no automation, no delivery integration",
    ],
    audience: "Vendors joining the ecosystem and building supply before they scale.",
    cta: "Start free",
    includedModules: ["catalog_items", "online_storefront", "reporting_basic"],
  },
  {
    id: "starter",
    name: "Starter",
    monthlyPriceLabel: "~$4",
    monthlyPriceCents: 400,
    catalogVerifiedItemCap: 300,
    purpose: "Serious listing vendor — move from passive listing to active selling.",
    tagline: "Larger verified catalogue, better storefront presence, simple BI, iTred inclusion.",
    highlights: [
      "Up to ~300 verified catalogue items",
      "Improved storefront presence",
      "Basic order flow (e.g. WhatsApp-led) & simple BI",
      "Still no POS — upgrade when you need the till",
    ],
    audience: "Vendors outgrowing Free who are not yet running in-store POS.",
    cta: "Choose Starter",
    includedModules: ["catalog_items", "online_storefront", "reporting_basic"],
  },
  {
    id: "lite-shop",
    name: "Lite Shop",
    monthlyPriceLabel: "~$6",
    monthlyPriceCents: 600,
    catalogVerifiedItemCap: 300,
    purpose: "Structured selling — operate more like a real shop without full POS yet.",
    tagline: "Structured order flow, customer interaction, basic tracking, improved visibility.",
    highlights: [
      "Catalogue + structured order flow",
      "Customer interaction layer & basic order tracking",
      "Improved visibility & simple reporting",
    ],
    audience: "Vendors standardising how they take and track orders.",
    cta: "Choose Lite Shop",
    includedModules: ["catalog_items", "online_storefront", "promotions", "reporting_basic"],
  },
  {
    id: "growth-pos",
    name: "Growth POS",
    monthlyPriceLabel: "~$18",
    monthlyPriceCents: 1800,
    catalogVerifiedItemCap: null,
    purpose: "Operational control — the core revenue anchor for real retail operations.",
    tagline: "Full POS, one shop + warehouse, stock & sales, basic delivery hooks, BI alerts.",
    highlights: [
      "Full point of sale",
      "One shop + one warehouse stock picture",
      "Sales tracking & discipline-oriented BI alerts",
      "Basic delivery integration",
    ],
    audience: "Vendors who need a stable till, stock control, and operational rhythm.",
    cta: "Choose Growth POS",
    featured: true,
    includedModules: [
      "catalog_items",
      "inventory_stock",
      "pos_checkout",
      "pos_multi_register",
      "staff_roles",
      "reporting_basic",
      "reporting_advanced",
    ],
  },
  {
    id: "growth-plus",
    name: "Growth Plus",
    monthlyPriceLabel: "~$30",
    monthlyPriceCents: 3000,
    catalogVerifiedItemCap: 600,
    purpose: "Managed business — control, permissions, and deeper insight.",
    tagline: "Expanded catalogue band, staff & permissions, approvals, deeper BI.",
    highlights: [
      "600+ verified catalogue band (policy-enforced)",
      "Staff management & permissions",
      "Approval flows",
      "Deeper BI insights",
    ],
    audience: "Growing teams that need accountability, not just transactions.",
    cta: "Choose Growth Plus",
    includedModules: [
      "catalog_items",
      "inventory_stock",
      "pos_checkout",
      "pos_multi_register",
      "cash_plan",
      "online_storefront",
      "promotions",
      "staff_roles",
      "reporting_basic",
      "reporting_advanced",
    ],
  },
  {
    id: "business",
    name: "Business",
    monthlyPriceLabel: "~$45",
    monthlyPriceCents: 4500,
    catalogVerifiedItemCap: null,
    purpose: "Multi-unit intelligence — branches, governance, advanced reporting.",
    tagline: "Multiple shops/branches, full BI layer, approvals, internal controls.",
    highlights: [
      "Multi-branch operations",
      "Full BI layer (alerts, scoring, governance posture)",
      "Advanced reporting & approval workflows",
    ],
    audience: "Structured operators running several locations or tight internal control.",
    cta: "Choose Business",
    includedModules: [
      "catalog_items",
      "inventory_stock",
      "pos_checkout",
      "pos_multi_register",
      "cash_plan",
      "online_storefront",
      "promotions",
      "staff_roles",
      "reporting_basic",
      "reporting_advanced",
      "multi_branch",
    ],
  },
  {
    id: "scale",
    name: "Scale",
    monthlyPriceLabel: "~$75",
    monthlyPriceCents: 7500,
    catalogVerifiedItemCap: null,
    purpose: "Ecosystem participation — network-scale commerce.",
    tagline: "Multi-branch + multi-warehouse, PoolWise-style collaboration, demand intelligence.",
    highlights: [
      "Multi-branch & multi-warehouse patterns",
      "Delivery optimisation & advanced demand signals",
      "Collaboration & ecosystem features",
      "Wholesale / B2B motion where applicable",
    ],
    audience: "Vendors who are part of the wider seiGEN network, not a single store.",
    cta: "Choose Scale",
    includedModules: [
      "catalog_items",
      "inventory_stock",
      "pos_checkout",
      "pos_multi_register",
      "cash_plan",
      "online_storefront",
      "promotions",
      "staff_roles",
      "reporting_basic",
      "reporting_advanced",
      "multi_branch",
      "api_integrations",
      "wholesale_b2b",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthlyPriceLabel: "Custom",
    monthlyPriceCents: 0,
    catalogVerifiedItemCap: null,
    purpose: "Infrastructure partner — bespoke integration, governance, and support.",
    tagline: "Custom integrations, full BI control, APIs, compliance-aligned rollout.",
    highlights: [
      "Full module access & custom integrations",
      "Governance layer & dedicated support",
      "Solution architecture aligned to your policies",
    ],
    audience: "Large or regulated operators needing bespoke infrastructure.",
    cta: "Talk to us",
    includedModules: [...ALL_PLAN_MODULES],
  },
];

const CANONICAL_PLAN_IDS = new Set<PlanId>(PLANS.map((p) => p.id));

/**
 * Returns null if the slug is not a known canonical or legacy plan id (empty string → null).
 * Use {@link normalizePlanId} when a DB value must always collapse to a tier (unknown → free).
 */
export function tryResolvePlanId(raw: string | null | undefined): PlanId | null {
  if (raw == null || raw === "") return null;
  if (CANONICAL_PLAN_IDS.has(raw as PlanId)) return raw as PlanId;
  const mapped = LEGACY_PLAN_ID_MAP[raw];
  return mapped ?? null;
}

/** Unknown slugs default to Free (safe for subscription rows that must always resolve). */
export function resolvePlanId(raw: string | null | undefined): PlanId {
  return tryResolvePlanId(raw) ?? "free";
}

/** Alias for workspace / billing — same as {@link resolvePlanId}. */
export function normalizePlanId(raw: string | null | undefined): PlanId {
  return resolvePlanId(raw);
}

export function getPlanById(id: string | null | undefined): CommercialPlan | undefined {
  if (id == null || id === "") return undefined;
  const canonical = tryResolvePlanId(id);
  if (canonical === null) return undefined;
  return PLANS.find((p) => p.id === canonical);
}

export function planIncludesModule(planId: PlanId, mod: PlanModule): boolean {
  const plan = getPlanById(planId);
  if (!plan) return false;
  return plan.includedModules.includes(mod);
}

export function modulesMissingFromPlan(plan: CommercialPlan): PlanModule[] {
  return ALL_PLAN_MODULES.filter((m) => !plan.includedModules.includes(m));
}

/** Verified catalogue soft cap for the tier (`null` = no app-enforced cap at this tier). */
export function catalogVerifiedItemCapForPlan(planId: PlanId | null | undefined): number | null {
  const plan = planId ? getPlanById(planId) : undefined;
  return plan?.catalogVerifiedItemCap ?? null;
}
