import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { SupabaseClient } from "@supabase/supabase-js";

export type MarketSpaceWorkspaceContext =
  | { ok: true; supabase: SupabaseClient; userId: string; tenantId: string }
  | { ok: false; error: string };

export async function resolveMarketSpaceWorkspaceContext(): Promise<MarketSpaceWorkspaceContext> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase not configured" };
  }
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { data: membership } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership?.tenant_id) return { ok: false, error: "No workspace tenant" };
  return { ok: true, supabase, userId: user.id, tenantId: membership.tenant_id as string };
}
