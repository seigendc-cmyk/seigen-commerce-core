import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";

export async function placeRecordHold(input: {
  recordType: string;
  recordId: string;
  holdType: "legal" | "trust" | "regulatory" | "investigation";
  reason: string;
}) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();

  const reason = input.reason?.trim();
  if (!reason) return { ok: false as const, error: "Hold reason is required." };

  const { data: hold, error } = await supabase
    .from("record_holds")
    .insert({
      tenant_id: ws.tenant.id,
      record_type: input.recordType,
      record_id: input.recordId,
      hold_type: input.holdType,
      reason,
      status: "active",
      placed_by: user.id,
    })
    .select("*")
    .single();
  if (error || !hold) return { ok: false as const, error: error?.message ?? "Insert failed" };

  // Flip flags on registry row.
  const flags: Record<string, boolean> =
    input.holdType === "legal"
      ? { is_on_legal_hold: true }
      : input.holdType === "trust"
        ? { is_on_trust_hold: true }
        : input.holdType === "regulatory"
          ? { is_on_regulatory_hold: true }
          : { is_on_legal_hold: true };
  await supabase
    .from("records_registry")
    .update({ ...flags, archive_status: "on_hold" })
    .eq("tenant_id", ws.tenant.id)
    .eq("record_type", input.recordType)
    .eq("record_id", input.recordId);

  return { ok: true as const, row: hold };
}

export async function releaseRecordHold(input: { holdId: string }) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const { data: hold } = await supabase.from("record_holds").select("*").eq("tenant_id", ws.tenant.id).eq("id", input.holdId).maybeSingle();
  if (!hold) return { ok: false as const, error: "Hold not found" };
  if (hold.status === "released") return { ok: true as const };

  const { error } = await supabase
    .from("record_holds")
    .update({ status: "released", released_by: user.id, released_at: new Date().toISOString() })
    .eq("tenant_id", ws.tenant.id)
    .eq("id", input.holdId);
  if (error) return { ok: false as const, error: error.message };

  // NOTE: We don't auto-clear registry flags in Pack 9 (could be multiple holds). A reconciler can derive effective holds.
  return { ok: true as const };
}

export async function listRecordHolds(input: { recordType?: string | null; recordId?: string | null; status?: "active" | "released" | null; limit?: number }) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const limit = input.limit ?? 200;
  const q = supabase.from("record_holds").select("*").eq("tenant_id", ws.tenant.id).order("placed_at", { ascending: false }).limit(limit);
  if (input.status) q.eq("status", input.status);
  if (input.recordType) q.eq("record_type", input.recordType);
  if (input.recordId) q.eq("record_id", input.recordId);
  const { data, error } = await q;
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, rows: data ?? [] };
}

