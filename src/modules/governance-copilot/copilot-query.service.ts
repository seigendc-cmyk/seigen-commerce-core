import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";
import { evaluateCopilotBoundary, type CopilotMode } from "./copilot-boundary.service";
import { resolveEffectivePolicyForContext } from "@/modules/governance-federation/applicability-resolver.service";
import { diffPolicyDefinitions } from "@/modules/policy-lifecycle/policy-diff.service";

export async function runCopilotQuery(input: {
  mode: CopilotMode;
  queryText: string;
  contextJson?: Record<string, unknown>;
}): Promise<{ ok: true; response: any } | { ok: false; error: string }> {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured" };

  const boundary = await evaluateCopilotBoundary({
    mode: input.mode,
    intent: input.queryText,
    requiredPermissionKeys: ["desk.sysadmin.access"],
  });
  if (!boundary.ok) return { ok: false, error: boundary.error };
  if (!boundary.allowed) return { ok: false, error: boundary.reason };

  const ctx = input.contextJson ?? {};
  let response: any = { mode: input.mode, limited: false };

  // Deterministic, non-AI responses for Pack 9 (structured helper).
  if (input.mode === "explain" && typeof ctx.policyCode === "string" && Array.isArray((ctx as any).scopeChain)) {
    const res = await resolveEffectivePolicyForContext({
      policyCode: String((ctx as any).policyCode),
      scopeChain: (ctx as any).scopeChain,
      asOfIso: typeof (ctx as any).asOfIso === "string" ? (ctx as any).asOfIso : undefined,
    });
    response = res;
  }

  if (input.mode === "compare" && (ctx as any).before && (ctx as any).after) {
    response = diffPolicyDefinitions((ctx as any).before, (ctx as any).after);
  }

  const supabase = await createServerSupabaseClient();
  await supabase.from("governance_copilot_queries").insert({
    tenant_id: ws.tenant.id,
    actor_user_id: user.id,
    mode: input.mode,
    query_text: input.queryText,
    context_json: ctx,
    response_summary: typeof response?.summary === "string" ? response.summary : null,
  });

  return { ok: true, response };
}

