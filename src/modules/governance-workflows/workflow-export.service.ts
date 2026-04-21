import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function csvEscape(s: string) {
  const needs = /[",\n]/.test(s);
  const v = s.replace(/"/g, '""');
  return needs ? `"${v}"` : v;
}

export async function exportWorkflowsCsv(input: { tenantId: string; sinceIso?: string; limit?: number }): Promise<{ ok: true; csv: string } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  let q = supabase.from("governance_workflows").select("*").eq("tenant_id", input.tenantId).order("started_at", { ascending: false }).limit(input.limit ?? 500);
  if (input.sinceIso) q = q.gte("started_at", input.sinceIso);
  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  const rows = (data ?? []) as any[];

  const header = ["id", "workflow_code", "status", "risk_level", "origin_permission_key", "origin_action_code", "requesting_user_id", "branch_id", "executive_visible", "trust_visible", "started_at"];
  const lines = [header.join(",")];
  for (const r of rows) {
    const vals = [
      r.id,
      r.workflow_code,
      r.status,
      r.risk_level,
      r.origin_permission_key,
      r.origin_action_code,
      r.requesting_user_id,
      r.branch_id ?? "",
      String(Boolean(r.executive_visible)),
      String(Boolean(r.trust_visible)),
      r.started_at,
    ].map((x) => csvEscape(String(x ?? "")));
    lines.push(vals.join(","));
  }
  return { ok: true, csv: lines.join("\n") };
}

