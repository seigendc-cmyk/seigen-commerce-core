import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { GovernanceDashboardSnapshot } from "./governance-metrics.types";

function emptySnapshot(): GovernanceDashboardSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    deniedAccess: { total: 0, last7d: 0, byPermission: [], byUser: [] },
    stepUp: { total: 0, byStatus: {} },
    approvals: { pendingLinks: 0, approvedLinks: 0, rejectedLinks: 0 },
    riskSignals: { repeatedDenialUsers: [], topDeniedPermissions: [] },
    overrides: { activeGrants: 0, activeDenies: 0 },
  };
}

export async function queryGovernanceDashboardSnapshot(tenantId: string): Promise<GovernanceDashboardSnapshot> {
  if (!isSupabaseConfigured()) return emptySnapshot();

  const supabase = await createServerSupabaseClient();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [denials, denials7d, denialsByPerm, denialsByUser, stepUps, apprPending, apprApproved, apprRejected, grants, denies] =
    await Promise.all([
      supabase.from("permission_denial_events").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
      supabase.from("permission_denial_events").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("created_at", since),
      supabase.from("permission_denial_events").select("permission_key").eq("tenant_id", tenantId).gte("created_at", since).limit(5000),
      supabase.from("permission_denial_events").select("user_id").eq("tenant_id", tenantId).gte("created_at", since).limit(5000),
      supabase.from("step_up_events").select("status").eq("tenant_id", tenantId).gte("created_at", since).limit(5000),
      supabase.from("approval_execution_links").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "pending"),
      supabase.from("approval_execution_links").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "approved"),
      supabase.from("approval_execution_links").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "rejected"),
      supabase
        .from("user_permission_overrides")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .eq("override_type", "grant"),
      supabase
        .from("user_permission_overrides")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .eq("override_type", "deny"),
    ]);

  const permCounts = new Map<string, number>();
  for (const row of (denialsByPerm.data ?? []) as { permission_key: string }[]) {
    const k = row.permission_key;
    permCounts.set(k, (permCounts.get(k) ?? 0) + 1);
  }
  const userCounts = new Map<string, number>();
  for (const row of (denialsByUser.data ?? []) as { user_id: string }[]) {
    const k = row.user_id;
    userCounts.set(k, (userCounts.get(k) ?? 0) + 1);
  }

  const statusCounts: Record<string, number> = {};
  for (const row of (stepUps.data ?? []) as { status: string }[]) {
    statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1;
  }

  const topPerms = Array.from(permCounts.entries())
    .map(([permissionKey, count]) => ({ permissionKey, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const repeatUsers = Array.from(userCounts.entries())
    .filter(([, c]) => c >= 3)
    .map(([userId, count]) => ({ userId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  return {
    generatedAt: new Date().toISOString(),
    deniedAccess: {
      total: denials.count ?? 0,
      last7d: denials7d.count ?? 0,
      byPermission: topPerms,
      byUser: Array.from(userCounts.entries())
        .map(([userId, count]) => ({ userId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 12),
    },
    stepUp: {
      total: stepUps.data?.length ?? 0,
      byStatus: statusCounts,
    },
    approvals: {
      pendingLinks: apprPending.count ?? 0,
      approvedLinks: apprApproved.count ?? 0,
      rejectedLinks: apprRejected.count ?? 0,
    },
    riskSignals: {
      repeatedDenialUsers: repeatUsers,
      topDeniedPermissions: topPerms,
    },
    overrides: {
      activeGrants: grants.count ?? 0,
      activeDenies: denies.count ?? 0,
    },
  };
}
