import type { PlanId } from "@/lib/plans";

export type TenantSubscriptionStatus =
  | "active"
  | "pending_activation"
  | "inactive"
  | "cancelled";

export type TenantMemberRole = "owner" | "admin" | "member";

/**
 * Workspace loaded on the server for authenticated users.
 * `tenant` / `subscription` are null until provisioning completes.
 */
export type DashboardWorkspacePayload = {
  user: { id: string; email: string | undefined };
  tenant: {
    id: string;
    name: string;
    contact_name: string | null;
    phone: string | null;
  } | null;
  subscription: {
    plan_id: PlanId;
    status: TenantSubscriptionStatus;
  } | null;
  memberRole: TenantMemberRole | null;
};
