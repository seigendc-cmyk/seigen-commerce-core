import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";

export type AlertSeverity = "info" | "warning" | "high" | "critical";
export type AlertStatus = "open" | "acknowledged" | "resolved" | "dismissed";

function nowIso() {
  return new Date().toISOString();
}

export async function upsertGovernanceAlert(input: {
  alertCode: string;
  severity: AlertSeverity;
  title: string;
  summary: string;
  entityType?: string | null;
  entityId?: string | null;
  relatedUserId?: string | null;
  relatedRoleCode?: string | null;
  branchId?: string | null;
  metadata?: Record<string, unknown>;
  dedupeKey?: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured" };

  const supabase = await createServerSupabaseClient();
  const dedupeKey = input.dedupeKey ?? `${input.alertCode}:${input.entityType ?? "none"}:${input.entityId ?? "none"}:${input.relatedUserId ?? "none"}`;

  const { data: existing } = await supabase
    .from("governance_alerts")
    .select("id, status")
    .eq("tenant_id", ws.tenant.id)
    .eq("alert_code", input.alertCode)
    .contains("metadata", { dedupeKey })
    .order("created_at", { ascending: false })
    .limit(1);

  if (existing && existing.length > 0 && ["open", "acknowledged"].includes(existing[0].status)) {
    // Update summary/severity to keep it fresh (no noisy duplicates)
    const { error } = await supabase
      .from("governance_alerts")
      .update({
        severity: input.severity,
        title: input.title,
        summary: input.summary,
        metadata: { ...(input.metadata ?? {}), dedupeKey, lastSeenAt: nowIso() },
      })
      .eq("id", existing[0].id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: existing[0].id as string };
  }

  const { data, error } = await supabase
    .from("governance_alerts")
    .insert({
      tenant_id: ws.tenant.id,
      alert_code: input.alertCode,
      severity: input.severity,
      title: input.title,
      summary: input.summary,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      related_user_id: input.relatedUserId ?? null,
      related_role_code: input.relatedRoleCode ?? null,
      branch_id: input.branchId ?? null,
      status: "open",
      metadata: { ...(input.metadata ?? {}), dedupeKey, createdBy: user.id },
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed" };
  return { ok: true, id: data.id as string };
}

export async function listAlerts(limit = 200): Promise<{ ok: true; rows: any[] } | { ok: false; error: string }> {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("governance_alerts")
    .select("*")
    .eq("tenant_id", ws.tenant.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: data ?? [] };
}

export async function actOnAlert(input: { alertId: string; action: "acknowledge" | "resolve" | "dismiss"; comment?: string }) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };

  const supabase = await createServerSupabaseClient();
  const nextStatus: AlertStatus = input.action === "acknowledge" ? "acknowledged" : input.action === "resolve" ? "resolved" : "dismissed";
  const { error } = await supabase.from("governance_alerts").update({ status: nextStatus }).eq("tenant_id", ws.tenant.id).eq("id", input.alertId);
  if (error) return { ok: false as const, error: error.message };
  await supabase.from("governance_alert_actions").insert({ governance_alert_id: input.alertId, actor_user_id: user.id, action: input.action, comment: input.comment ?? null });
  return { ok: true as const };
}

