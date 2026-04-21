import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";

export async function writeFederationAuditEvent(input: {
  eventCode: string;
  title: string;
  summary?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();

  // Pack 9 keeps audit events inside existing governance_workflow_timeline / adoption events where possible.
  // For now, we log to copilot queries table as a minimal append-only audit channel.
  const { error } = await supabase.from("governance_copilot_queries").insert({
    tenant_id: ws.tenant.id,
    actor_user_id: user.id,
    mode: "summarize",
    query_text: `[federation-audit] ${input.eventCode}`,
    context_json: { title: input.title, summary: input.summary ?? null, metadata: input.metadata ?? {} },
    response_summary: null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

