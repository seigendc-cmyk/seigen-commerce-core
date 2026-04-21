import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";

function nowIso() {
  return new Date().toISOString();
}

/**
 * Pack 5: simple, explainable recommendations (not autonomous).
 * Runs on-demand from UI; in production can run scheduled.
 */
export async function generateGovernanceRecommendations(): Promise<{ ok: true; created: number } | { ok: false; error: string }> {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured" };

  const supabase = await createServerSupabaseClient();

  // Pattern 1: repeated denials on same permission by same user (training or role gap)
  const { data: denials } = await supabase
    .from("permission_denial_events")
    .select("user_id, permission_key")
    .eq("tenant_id", ws.tenant.id)
    .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString())
    .limit(5000);

  const counts = new Map<string, number>();
  for (const d of (denials ?? []) as any[]) {
    const k = `${d.user_id}:${d.permission_key}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  let created = 0;
  for (const [k, c] of counts) {
    if (c < 8) continue;
    const [userId, permissionKey] = k.split(":");
    const code = "rec.training_or_role_gap";

    const { data: existing } = await supabase
      .from("governance_recommendations")
      .select("id")
      .eq("tenant_id", ws.tenant.id)
      .eq("recommendation_code", code)
      .contains("source_metric_json", { userId, permissionKey })
      .limit(1);
    if (existing && existing.length > 0) continue;

    const ins = await supabase.from("governance_recommendations").insert({
      tenant_id: ws.tenant.id,
      recommendation_code: code,
      category: "training",
      severity: "warning",
      title: "Repeated blocked action suggests training or role change",
      summary: `User repeatedly attempted a blocked action (${permissionKey}).`,
      rationale: `Observed ${c} denials in the last 7 days for the same user and permission key.`,
      suggested_action: "Review role design for this function or add training/self-help guidance in the UI.",
      status: "open",
      source_metric_json: { windowDays: 7, count: c, userId, permissionKey, generatedAt: nowIso() },
      entity_type: "permission",
      entity_id: null,
    });
    if (!ins.error) created += 1;
  }

  return { ok: true, created };
}

export async function listRecommendations(limit = 200): Promise<{ ok: true; rows: any[] } | { ok: false; error: string }> {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("governance_recommendations")
    .select("*")
    .eq("tenant_id", ws.tenant.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: data ?? [] };
}

export async function actOnRecommendation(input: { recommendationId: string; status: "accepted" | "dismissed" | "implemented"; comment?: string }) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("governance_recommendations").update({ status: input.status }).eq("tenant_id", ws.tenant.id).eq("id", input.recommendationId);
  if (error) return { ok: false as const, error: error.message };
  await supabase.from("governance_recommendation_actions").insert({ governance_recommendation_id: input.recommendationId, actor_user_id: user.id, action: input.status, comment: input.comment ?? null });
  return { ok: true as const };
}

