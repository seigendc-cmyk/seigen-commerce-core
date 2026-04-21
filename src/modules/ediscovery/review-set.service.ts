import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";

export async function createReviewSet(input: { matterId: string; title: string; summary?: string | null }) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("ediscovery_review_sets")
    .insert({
      tenant_id: ws.tenant.id,
      ediscovery_matter_id: input.matterId,
      title: input.title.trim() || "Review set",
      summary: input.summary?.trim() ?? null,
      status: "open",
      created_by: user.id,
    })
    .select("*")
    .single();
  if (error || !data) return { ok: false as const, error: error?.message ?? "Insert failed" };
  return { ok: true as const, row: data };
}

export async function addItemsToReviewSet(input: { reviewSetId: string; items: Array<{ recordType: string; recordId: string; metadata?: Record<string, unknown> }> }) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  if (input.items.length < 1) return { ok: true as const, inserted: 0 };
  const { error } = await supabase.from("ediscovery_review_set_items").insert(
    input.items.map((it) => ({
      tenant_id: ws.tenant.id,
      ediscovery_review_set_id: input.reviewSetId,
      record_type: it.recordType,
      record_id: it.recordId,
      metadata: it.metadata ?? {},
    })),
  );
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, inserted: input.items.length };
}

export async function getReviewSetBundle(reviewSetId: string) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const [{ data: setRow, error: sErr }, { data: items, error: iErr }] = await Promise.all([
    supabase.from("ediscovery_review_sets").select("*").eq("tenant_id", ws.tenant.id).eq("id", reviewSetId).maybeSingle(),
    supabase.from("ediscovery_review_set_items").select("*").eq("tenant_id", ws.tenant.id).eq("ediscovery_review_set_id", reviewSetId).order("created_at", { ascending: false }),
  ]);
  if (sErr || !setRow) return { ok: false as const, error: sErr?.message ?? "Not found" };
  if (iErr) return { ok: false as const, error: iErr.message };
  return { ok: true as const, reviewSet: setRow, items: items ?? [] };
}

