import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";
import { scopeSpecificityRank } from "./constants";
import type { FederationScopeType } from "./types";

type PolicyRow = {
  id: string;
  tenantId: string | null;
  policyCode: string;
  isProtected: boolean;
  status: string;
};

type PolicyVersionRow = {
  id: string;
  governancePolicyId: string;
  versionStatus: string;
  policyDefinitionJson: Record<string, unknown>;
};

type OverlayRow = {
  id: string;
  tenantId: string | null;
  basePolicyId: string;
  overlayScopeType: "region" | "country" | "tenant" | "branch";
  overlayScopeId: string;
  overlayCode: string;
  title: string;
  status: string;
  overlayDefinitionJson: Record<string, unknown>;
  priorityRank: number;
  effectiveFrom: string;
  effectiveTo: string | null;
};

export type EffectivePolicyResolution = {
  ok: true;
  policyId: string;
  policyCode: string;
  baseVersionId: string;
  appliedOverlayIds: string[];
  appliedOverlays: Array<{ id: string; overlayCode: string; title: string; scopeType: OverlayRow["overlayScopeType"]; scopeId: string; priorityRank: number }>;
  effectiveDefinitionJson: Record<string, unknown>;
  basis: {
    asOfIso: string;
    scopeChain: Array<{ scopeType: FederationScopeType; scopeId: string }>;
  };
  explanation: {
    winnerRule: string;
    blockedOverride?: boolean;
  };
};

function deepMerge(base: any, overlay: any): any {
  if (Array.isArray(base) || Array.isArray(overlay)) return overlay ?? base;
  if (base && typeof base === "object" && overlay && typeof overlay === "object") {
    const out: Record<string, any> = { ...base };
    for (const [k, v] of Object.entries(overlay)) {
      out[k] = deepMerge((base as any)[k], v);
    }
    return out;
  }
  return overlay === undefined ? base : overlay;
}

function nowIso() {
  return new Date().toISOString();
}

function mapPolicy(r: any): PolicyRow {
  return {
    id: String(r.id),
    tenantId: (r.tenant_id as string | null) ?? null,
    policyCode: String(r.policy_code),
    isProtected: Boolean(r.is_protected),
    status: String(r.status),
  };
}

function mapVersion(r: any): PolicyVersionRow {
  return {
    id: String(r.id),
    governancePolicyId: String(r.governance_policy_id),
    versionStatus: String(r.version_status),
    policyDefinitionJson: (r.policy_definition_json as any) ?? {},
  };
}

function mapOverlay(r: any): OverlayRow {
  return {
    id: String(r.id),
    tenantId: (r.tenant_id as string | null) ?? null,
    basePolicyId: String(r.base_policy_id),
    overlayScopeType: r.overlay_scope_type,
    overlayScopeId: String(r.overlay_scope_id),
    overlayCode: String(r.overlay_code),
    title: String(r.title),
    status: String(r.status),
    overlayDefinitionJson: (r.overlay_definition_json as any) ?? {},
    priorityRank: Number(r.priority_rank ?? 100),
    effectiveFrom: String(r.effective_from),
    effectiveTo: (r.effective_to as string | null) ?? null,
  };
}

export async function resolveEffectivePolicyForContext(input: {
  policyCode: string;
  asOfIso?: string;
  /** Most specific scope, e.g. branch scope id; resolver climbs upward using provided chain. */
  scopeChain: Array<{ scopeType: FederationScopeType; scopeId: string }>;
}): Promise<EffectivePolicyResolution | { ok: false; error: string }> {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const asOf = input.asOfIso ?? nowIso();

  // Fetch policy (tenant wins over global).
  const { data: polRows, error: polErr } = await supabase
    .from("governance_policies")
    .select("id,tenant_id,policy_code,is_protected,status")
    .eq("policy_code", input.policyCode)
    .or(`tenant_id.eq.${ws.tenant.id},tenant_id.is.null`)
    .limit(10);
  if (polErr) return { ok: false, error: polErr.message };
  const policies = (polRows ?? []).map(mapPolicy);
  const policy = policies.find((p) => p.tenantId === ws.tenant.id) ?? policies.find((p) => p.tenantId === null);
  if (!policy) return { ok: false, error: "Policy not found." };

  // Published version.
  const { data: vRow, error: vErr } = await supabase
    .from("governance_policy_versions")
    .select("id,governance_policy_id,version_status,policy_definition_json")
    .eq("governance_policy_id", policy.id)
    .eq("version_status", "published")
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (vErr || !vRow) return { ok: false, error: vErr?.message ?? "No published version." };
  const baseVersion = mapVersion(vRow);

  // Overlays: only published, in-date, matching any scope id in chain.
  const scopeIds = input.scopeChain.map((s) => s.scopeId);
  const { data: oRows, error: oErr } = await supabase
    .from("policy_overlays")
    .select("*")
    .eq("base_policy_id", policy.id)
    .eq("status", "published")
    .in("overlay_scope_id", scopeIds)
    .lte("effective_from", asOf)
    .or(`effective_to.is.null,effective_to.gt.${asOf}`)
    .limit(200);
  if (oErr) return { ok: false, error: oErr.message };
  const overlays = (oRows ?? []).map(mapOverlay);

  // Deterministic ordering: specificity (branch->tenant->country->region) then priority_rank then effective_from.
  const typeRank = (t: OverlayRow["overlayScopeType"]) => {
    const mapped: FederationScopeType = t === "branch" ? "branch" : t === "tenant" ? "tenant" : t === "country" ? "country" : "region";
    return scopeSpecificityRank(mapped);
  };
  const sorted = overlays
    .slice()
    .sort((a, b) => typeRank(b.overlayScopeType) - typeRank(a.overlayScopeType) || a.priorityRank - b.priorityRank || b.effectiveFrom.localeCompare(a.effectiveFrom));

  // Protected base policy blocks overlays (still report candidates).
  if (policy.isProtected && sorted.length > 0) {
    return {
      ok: true,
      policyId: policy.id,
      policyCode: policy.policyCode,
      baseVersionId: baseVersion.id,
      appliedOverlayIds: [],
      appliedOverlays: [],
      effectiveDefinitionJson: baseVersion.policyDefinitionJson,
      basis: { asOfIso: asOf, scopeChain: input.scopeChain },
      explanation: { winnerRule: "Base policy is protected; overlays blocked.", blockedOverride: true },
    };
  }

  let effective: Record<string, unknown> = baseVersion.policyDefinitionJson ?? {};
  const applied: OverlayRow[] = [];
  for (const o of sorted) {
    effective = deepMerge(effective, o.overlayDefinitionJson);
    applied.push(o);
  }

  return {
    ok: true,
    policyId: policy.id,
    policyCode: policy.policyCode,
    baseVersionId: baseVersion.id,
    appliedOverlayIds: applied.map((x) => x.id),
    appliedOverlays: applied.map((x) => ({
      id: x.id,
      overlayCode: x.overlayCode,
      title: x.title,
      scopeType: x.overlayScopeType,
      scopeId: x.overlayScopeId,
      priorityRank: x.priorityRank,
    })),
    effectiveDefinitionJson: effective,
    basis: { asOfIso: asOf, scopeChain: input.scopeChain },
    explanation: { winnerRule: "Base published policy + ordered overlays merged." },
  };
}

