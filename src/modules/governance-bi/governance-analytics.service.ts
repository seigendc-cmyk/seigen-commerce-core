import type { GovernanceDashboardSnapshot } from "./governance-metrics.types";
import { queryGovernanceDashboardSnapshot } from "./governance-dashboard.queries";

export async function getGovernanceDashboardSnapshot(tenantId: string): Promise<GovernanceDashboardSnapshot> {
  return queryGovernanceDashboardSnapshot(tenantId);
}
