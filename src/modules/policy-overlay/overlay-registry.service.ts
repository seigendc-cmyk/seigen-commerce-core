import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";
import { validateOverlayDefinition } from "./overlay-validation.service";

export type PolicyOverlayRow = {
  id: string;
  tenantId: string | null;
  basePolicyId: string;
  basePolicyVersionId: string | null;
  overlayScopeType: "region" | "country" | "tenant" | "branch";
  overlayScopeId: string;
  overlayCode: string;
  title: string;
  status: "draft" | "approved" | "published" | "superseded" | "archived";
  overlayDefinitionJson: Record<string, unknown>;
  changeSummary: string;
  priorityRank: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapOverlay(r: any): PolicyOverlayRow {
  return {
    id: String(r.id),
    tenantId: (r.tenant_id as string | null) ?? null,
    basePolicyId: String(r.base_policy_id),
    basePolicyVersionId: (r.base_policy_version_id as string | null) ?? null,
    overlayScopeType: r.overlay_scope_type,
    overlayScopeId: String(r.overlay_scope_id),
    overlayCode: String(r.overlay_code),
    title: String(r.title),
    status: r.status,
    overlayDefinitionJson: (r.overlay_definition_json as any) ?? {},
    changeSummary: String(r.change_summary ?? ""),
    priorityRank: Number(r.priority_rank ?? 100),
    effectiveFrom: String(r.effective_from),
    effectiveTo: (r.effective_to as string | null) ?? null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export async function listPolicyOverlays(input?: { basePolicyId?: string | null; limit?: number }) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!user) return { ok: false as const, error: "Not signed in" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const tenantId = ws?.tenant?.id ?? null;
  const limit = input?.limit ?? 200;
  const q = supabase.from("policy_overlays").select("*").order("updated_at", { ascending: false }).limit(limit);
  if (input?.basePolicyId) q.eq("base_policy_id", input.basePolicyId);
  if (tenantId) q.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
  const { data, error } = await q;
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, rows: (data ?? []).map(mapOverlay) };
}

export async function createPolicyOverlay(input: {
  basePolicyId: string;
  basePolicyVersionId?: string | null;
  overlayScopeType: PolicyOverlayRow["overlayScopeType"];
  overlayScopeId: string;
  overlayCode: string;
  title: string;
  overlayDefinitionJson: Record<string, unknown>;
  changeSummary: string;
  priorityRank?: number;
  effectiveFrom?: string;
  effectiveTo?: string | null;
}) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const valid = validateOverlayDefinition({ overlayDefinitionJson: input.overlayDefinitionJson, allowedRootKeys: null });
  if (!valid.ok) return valid;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("policy_overlays")
    .insert({
      tenant_id: ws.tenant.id,
      base_policy_id: input.basePolicyId,
      base_policy_version_id: input.basePolicyVersionId ?? null,
      overlay_scope_type: input.overlayScopeType,
      overlay_scope_id: input.overlayScopeId,
      overlay_code: input.overlayCode,
      title: input.title,
      status: "draft",
      overlay_definition_json: input.overlayDefinitionJson,
      change_summary: input.changeSummary,
      priority_rank: input.priorityRank ?? 100,
      effective_from: input.effectiveFrom ?? new Date().toISOString(),
      effective_to: input.effectiveTo ?? null,
      created_by: user.id,
    })
    .select("*")
    .single();
  if (error || !data) return { ok: false as const, error: error?.message ?? "Insert failed" };
  return { ok: true as const, row: mapOverlay(data) };
}

export async function publishPolicyOverlay(input: { overlayId: string }) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const { data: row, error } = await supabase
    .from("policy_overlays")
    .update({ status: "published", updated_at: new Date().toISOString() })
    .eq("tenant_id", ws.tenant.id)
    .eq("id", input.overlayId)
    .select("*")
    .maybeSingle();
  if (error || !row) return { ok: false as const, error: error?.message ?? "Not found" };
  return { ok: true as const, row: mapOverlay(row) };
}

