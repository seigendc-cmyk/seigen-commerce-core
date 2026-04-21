import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";

export async function ediscoverySearch(input: {
  matterId?: string | null;
  q?: string | null;
  recordType?: string | null;
  classification?: string | null;
  limit?: number;
}) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const limit = input.limit ?? 100;

  // Audit search query (tight governance requirement).
  await supabase.from("ediscovery_search_audit").insert({
    tenant_id: ws.tenant.id,
    actor_user_id: user.id,
    matter_id: input.matterId ?? null,
    query_json: { q: input.q ?? null, recordType: input.recordType ?? null, classification: input.classification ?? null, limit },
  });

  const q = supabase.from("records_registry").select("*").eq("tenant_id", ws.tenant.id).order("updated_at", { ascending: false }).limit(limit);
  if (input.recordType) q.eq("record_type", input.recordType);
  if (input.classification) q.eq("record_classification", input.classification);
  if (input.q?.trim()) q.ilike("indexed_text", `%${input.q.trim()}%`);
  const { data, error } = await q;
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, rows: data ?? [] };
}

