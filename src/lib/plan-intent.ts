import { getPlanById, type PlanId } from "./plans";

const KEY = "seigen_selected_plan_v1";

function isPlanId(v: string): v is PlanId {
  return getPlanById(v) !== undefined;
}

export function setSelectedPlanIntent(planId: PlanId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, planId);
  } catch {
    /* ignore quota / privacy mode */
  }
}

export function getSelectedPlanIntent(): PlanId | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(KEY);
    if (!v || !isPlanId(v)) return null;
    return v;
  } catch {
    return null;
  }
}
