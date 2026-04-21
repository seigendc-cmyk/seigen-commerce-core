import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";

export async function upsertRecordIndex(input: {
  recordType: string;
  recordId: string;
  recordClassification: string;
  recordSeriesCode?: string | null;
  retentionScheduleCode?: string | null;
  indexedText?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("records_registry")
    .upsert(
      {
        tenant_id: ws.tenant.id,
        record_type: input.recordType,
        record_id: input.recordId,
        record_classification: input.recordClassification,
        record_series_code: input.recordSeriesCode ?? null,
        retention_schedule_code: input.retentionScheduleCode ?? null,
        indexed_text: input.indexedText ?? null,
        metadata: input.metadata ?? {},
      },
      { onConflict: "tenant_id,record_type,record_id" },
    )
    .select("*")
    .single();
  if (error || !data) return { ok: false as const, error: error?.message ?? "Upsert failed" };
  return { ok: true as const, row: data };
}

export async function listRecords(input?: { classification?: string | null; q?: string | null; limit?: number }) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const limit = input?.limit ?? 200;
  const q = supabase.from("records_registry").select("*").eq("tenant_id", ws.tenant.id).order("updated_at", { ascending: false }).limit(limit);
  if (input?.classification) q.eq("record_classification", input.classification);
  if (input?.q?.trim()) q.ilike("indexed_text", `%${input.q.trim()}%`);
  const { data, error } = await q;
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, rows: data ?? [] };
}

