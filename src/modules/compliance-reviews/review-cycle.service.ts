import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";

function nowIso() {
  return new Date().toISOString();
}

function addDays(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60_000).toISOString();
}

/**
 * Minimal review cycle engine.
 * schedule_rule format: "every:N:days" for Pack 8 baseline.
 */
export async function upsertReviewCycle(input: {
  reviewCode: string;
  title: string;
  description?: string | null;
  reviewType: string;
  subjectType: string;
  subjectId?: string | null;
  scheduleRule: string; // e.g. every:30:days
  ownerRoleCode?: string | null;
  requiresEvidenceBundle?: boolean;
  requiresResolution?: boolean;
}) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("compliance_review_cycles").upsert(
    {
      tenant_id: ws.tenant.id,
      review_code: input.reviewCode,
      title: input.title,
      description: input.description ?? null,
      review_type: input.reviewType,
      subject_type: input.subjectType,
      subject_id: input.subjectId ?? null,
      schedule_rule: input.scheduleRule,
      owner_role_code: input.ownerRoleCode ?? null,
      requires_evidence_bundle: input.requiresEvidenceBundle ?? false,
      requires_resolution: input.requiresResolution ?? false,
      is_active: true,
    },
    { onConflict: "tenant_id,review_code" },
  );
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function generateNextReviewInstances(limitCycles = 50) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();

  const { data: cycles, error } = await supabase.from("compliance_review_cycles").select("*").eq("tenant_id", ws.tenant.id).eq("is_active", true).limit(limitCycles);
  if (error) return { ok: false as const, error: error.message };

  let created = 0;
  for (const c of (cycles ?? []) as any[]) {
    const rule = String(c.schedule_rule ?? "");
    const m = rule.match(/^every:(\d+):days$/);
    const intervalDays = m ? Number(m[1]) : 30;

    const { data: last } = await supabase
      .from("compliance_review_instances")
      .select("id,due_at,status")
      .eq("compliance_review_cycle_id", c.id)
      .order("due_at", { ascending: false })
      .limit(1);

    const nextDue = last && last.length > 0 ? new Date(new Date(last[0].due_at).getTime() + intervalDays * 24 * 60 * 60_000).toISOString() : addDays(intervalDays);

    // If a scheduled/open/in_review instance already exists within interval window, skip
    const { data: existing } = await supabase
      .from("compliance_review_instances")
      .select("id")
      .eq("compliance_review_cycle_id", c.id)
      .in("status", ["scheduled", "open", "in_review", "overdue"])
      .gte("due_at", new Date(Date.now() - intervalDays * 24 * 60 * 60_000).toISOString())
      .limit(1);
    if (existing && existing.length > 0) continue;

    const ins = await supabase.from("compliance_review_instances").insert({
      compliance_review_cycle_id: c.id,
      due_at: nextDue,
      status: "scheduled",
      assigned_role_code: c.owner_role_code ?? null,
      assigned_to_user_id: c.owner_user_id ?? null,
      summary: null,
      result_json: {},
    });
    if (!ins.error) created += 1;
  }

  return { ok: true as const, created };
}

export async function listReviewInstances(limit = 200) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("compliance_review_instances")
    .select("*, compliance_review_cycles:compliance_review_cycle_id(review_code,title,review_type,subject_type,subject_id)")
    .order("due_at", { ascending: true })
    .limit(limit);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, rows: data ?? [] };
}

export async function markOverdueReviews() {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const tNow = nowIso();
  const { data, error } = await supabase
    .from("compliance_review_instances")
    .select("id")
    .in("status", ["scheduled", "open", "in_review"])
    .lt("due_at", tNow)
    .limit(500);
  if (error) return { ok: false as const, error: error.message };
  const ids = (data ?? []).map((x: any) => x.id);
  if (ids.length === 0) return { ok: true as const, updated: 0 };
  await supabase.from("compliance_review_instances").update({ status: "overdue" }).in("id", ids);
  return { ok: true as const, updated: ids.length };
}

