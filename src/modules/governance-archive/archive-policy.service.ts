import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";

function nowIso() {
  return new Date().toISOString();
}

export async function upsertArchivePolicy(input: {
  policyCode: string;
  subjectType: string;
  retentionPeriodDays: number;
  archiveAfterDays: number;
  requiresLegalHoldCheck?: boolean;
  requiresExecutiveHoldCheck?: boolean;
  requiresTrustHoldCheck?: boolean;
}) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("archive_policies").upsert(
    {
      tenant_id: ws.tenant.id,
      policy_code: input.policyCode,
      subject_type: input.subjectType,
      retention_period_days: input.retentionPeriodDays,
      archive_after_days: input.archiveAfterDays,
      requires_legal_hold_check: input.requiresLegalHoldCheck ?? true,
      requires_executive_hold_check: input.requiresExecutiveHoldCheck ?? false,
      requires_trust_hold_check: input.requiresTrustHoldCheck ?? false,
      is_active: true,
    },
    { onConflict: "tenant_id,policy_code" } as any,
  );
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function listArchiveRecords(limit = 200) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("archive_records").select("*").eq("tenant_id", ws.tenant.id).order("updated_at", { ascending: false }).limit(limit);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, rows: data ?? [] };
}

export async function recordEligibleArchive(input: { subjectType: string; subjectId: string; archivePolicyId: string; purgeDueAtIso?: string | null; metadata?: Record<string, unknown> }) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("archive_records").upsert(
    {
      tenant_id: ws.tenant.id,
      subject_type: input.subjectType,
      subject_id: input.subjectId,
      archive_policy_id: input.archivePolicyId,
      archive_status: "eligible",
      archived_at: null,
      purge_due_at: input.purgeDueAtIso ?? null,
      metadata: input.metadata ?? {},
    },
    { onConflict: "tenant_id,subject_type,subject_id" },
  );
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function markArchived(input: { recordId: string; holdReason?: string | null }) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("archive_records")
    .update({ archive_status: input.holdReason ? "on_hold" : "archived", archived_at: nowIso(), hold_reason: input.holdReason ?? null })
    .eq("tenant_id", ws.tenant.id)
    .eq("id", input.recordId);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function auditRetrieval(input: { subjectType: string; subjectId: string; reason: string }) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("retrieval_audit_events").insert({
    tenant_id: ws.tenant.id,
    subject_type: input.subjectType,
    subject_id: input.subjectId,
    actor_user_id: user.id,
    reason: input.reason,
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

