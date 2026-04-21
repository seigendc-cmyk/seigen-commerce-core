import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";

export async function createEdiscoveryMatter(input: { matterCode: string; title: string; summary?: string | null }) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const matterCode = input.matterCode.trim();
  if (!matterCode) return { ok: false as const, error: "Matter code required." };
  const { data, error } = await supabase
    .from("ediscovery_matters")
    .insert({
      tenant_id: ws.tenant.id,
      matter_code: matterCode,
      title: input.title.trim() || matterCode,
      summary: input.summary?.trim() ?? null,
      status: "open",
      opened_by: user.id,
    })
    .select("*")
    .single();
  if (error || !data) return { ok: false as const, error: error?.message ?? "Insert failed" };
  return { ok: true as const, row: data };
}

export async function listEdiscoveryMatters(limit = 100) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("ediscovery_matters").select("*").eq("tenant_id", ws.tenant.id).order("opened_at", { ascending: false }).limit(limit);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, rows: data ?? [] };
}

