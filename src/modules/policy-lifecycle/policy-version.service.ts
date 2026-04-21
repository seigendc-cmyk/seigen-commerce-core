import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";
import type { GovernancePolicyRow, GovernancePolicyVersionRow } from "./types";

function mapPolicy(p: any): GovernancePolicyRow {
  return {
    id: String(p.id),
    tenantId: (p.tenant_id as string | null) ?? null,
    policyCode: String(p.policy_code),
    policyType: String(p.policy_type),
    title: String(p.title),
    description: (p.description as string | null) ?? null,
    owningModuleCode: String(p.owning_module_code),
    status: p.status,
    currentVersionNumber: Number(p.current_version_number),
    isSystem: Boolean(p.is_system),
    isProtected: Boolean(p.is_protected),
    requiresApproval: Boolean(p.requires_approval),
    requiresExecutiveVisibility: Boolean(p.requires_executive_visibility),
    requiresTrustVisibility: Boolean(p.requires_trust_visibility),
  };
}

function mapVersion(v: any): GovernancePolicyVersionRow {
  return {
    id: String(v.id),
    governancePolicyId: String(v.governance_policy_id),
    versionNumber: Number(v.version_number),
    versionStatus: v.version_status,
    changeSummary: String(v.change_summary ?? ""),
    policyDefinitionJson: (v.policy_definition_json as any) ?? {},
    effectiveFrom: String(v.effective_from),
    effectiveTo: (v.effective_to as string | null) ?? null,
    publishedAt: (v.published_at as string | null) ?? null,
  };
}

export async function listPolicies(): Promise<{ ok: true; rows: GovernancePolicyRow[] } | { ok: false; error: string }> {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("governance_policies").select("*").or(`tenant_id.eq.${ws.tenant.id},tenant_id.is.null`).order("policy_code", { ascending: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: (data ?? []).map(mapPolicy) };
}

export async function getPolicyBundle(policyId: string): Promise<{ ok: true; policy: GovernancePolicyRow; versions: GovernancePolicyVersionRow[] } | { ok: false; error: string }> {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const [{ data: pol, error: pErr }, { data: vers, error: vErr }] = await Promise.all([
    supabase.from("governance_policies").select("*").or(`tenant_id.eq.${ws.tenant.id},tenant_id.is.null`).eq("id", policyId).maybeSingle(),
    supabase.from("governance_policy_versions").select("*").eq("governance_policy_id", policyId).order("version_number", { ascending: false }),
  ]);
  if (pErr || !pol) return { ok: false, error: pErr?.message ?? "Not found" };
  if (vErr) return { ok: false, error: vErr.message };
  return { ok: true, policy: mapPolicy(pol), versions: (vers ?? []).map(mapVersion) };
}

export async function createDraftVersion(input: { policyId: string; fromVersionId?: string | null; changeSummary: string; definitionJson: Record<string, unknown> }) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const { data: pol } = await supabase.from("governance_policies").select("id,current_version_number").eq("id", input.policyId).maybeSingle();
  if (!pol) return { ok: false as const, error: "Policy not found." };
  const nextVersion = Number(pol.current_version_number ?? 0) + 1;
  const { data, error } = await supabase
    .from("governance_policy_versions")
    .insert({
      governance_policy_id: input.policyId,
      version_number: nextVersion,
      version_status: "draft",
      change_summary: input.changeSummary,
      policy_definition_json: input.definitionJson,
    })
    .select("*")
    .single();
  if (error || !data) return { ok: false as const, error: error?.message ?? "Insert failed" };
  await supabase.from("governance_policies").update({ status: "draft", current_version_number: nextVersion }).eq("id", input.policyId);
  return { ok: true as const, version: mapVersion(data) };
}

