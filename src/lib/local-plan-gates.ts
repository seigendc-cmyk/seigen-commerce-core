import type { DemoVendorSession } from "./demo-session";
import { getPlanById, type PlanId, type PlanModule } from "./plans";

/**
 * Product areas under /dashboard that map to plan modules.
 * Used for local demo gating; replace with server entitlements later.
 */
export type DashboardProductArea = "inventory" | "pos" | "cashplan";

export type DashboardAreaGateSpec = {
  /** All listed modules must be on the plan for access. */
  requiredModules: readonly PlanModule[];
  title: string;
  shortLabel: string;
  description: string;
};

export const DASHBOARD_AREA_GATES: Record<DashboardProductArea, DashboardAreaGateSpec> = {
  inventory: {
    requiredModules: ["inventory_stock"],
    title: "Inventory",
    shortLabel: "Inventory & catalog",
    description:
      "Product catalog, on-hand stock, receiving, and purchasing need inventory management on your subscription.",
  },
  pos: {
    requiredModules: ["pos_checkout"],
    title: "Point of sale",
    shortLabel: "Point of sale",
    description:
      "Registers, checkout, tenders, and receipts require a plan that includes point of sale.",
  },
};

/** Whether the plan grants access to a dashboard product area (local / static plan only). */
export function planAllowsDashboardArea(planId: PlanId | null | undefined, area: DashboardProductArea): boolean {
  const plan = planId ? getPlanById(planId) : undefined;
  if (!plan) return false;
  const { requiredModules } = DASHBOARD_AREA_GATES[area];
  return requiredModules.every((m) => plan.includedModules.includes(m));
}

/** Same as {@link planAllowsDashboardArea} using a demo session row. */
export function sessionAllowsDashboardArea(
  session: DemoVendorSession | null | undefined,
  area: DashboardProductArea,
): boolean {
  if (!session) return false;
  return planAllowsDashboardArea(session.planId, area);
}
