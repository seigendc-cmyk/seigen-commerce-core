import { normalizePlanId, type PlanId } from "@/lib/plans";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { DashboardWorkspacePayload, TenantMemberRole, TenantSubscriptionStatus } from "./types";

export async function getDashboardWorkspace(): Promise<DashboardWorkspacePayload | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) return null;

  const { data: membership } = await supabase
    .from("tenant_members")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return {
      user: { id: user.id, email: user.email },
      tenant: null,
      subscription: null,
      memberRole: null,
    };
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, name, contact_name, phone")
    .eq("id", membership.tenant_id)
    .maybeSingle();

  const { data: sub } = await supabase
    .from("tenant_subscriptions")
    .select("plan_id, status")
    .eq("tenant_id", membership.tenant_id)
    .maybeSingle();

  return {
    user: { id: user.id, email: user.email },
    tenant: tenant
      ? {
          id: tenant.id,
          name: tenant.name,
          contact_name: tenant.contact_name,
          phone: tenant.phone,
        }
      : null,
    subscription: sub
      ? {
          plan_id: normalizePlanId(sub.plan_id as string | undefined),
          status: sub.status as TenantSubscriptionStatus,
        }
      : null,
    memberRole: membership.role as TenantMemberRole,
  };
}
