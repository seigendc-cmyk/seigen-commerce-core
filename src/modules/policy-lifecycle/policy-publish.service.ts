import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";

function nowIso() {
  return new Date().toISOString();
}

export async function publishPolicyVersion(input: { policyId: string; versionId: string }) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();

  const { data: pol } = await supabase.from("governance_policies").select("*").eq("id", input.policyId).maybeSingle();
  if (!pol) return { ok: false as const, error: "Policy not found" };

  const { data: ver } = await supabase.from("governance_policy_versions").select("*").eq("id", input.versionId).eq("governance_policy_id", input.policyId).maybeSingle();
  if (!ver) return { ok: false as const, error: "Version not found" };
  if (ver.version_status === "published") return { ok: true as const };

  // Supersede existing published version (preserve history)
  const { data: published } = await supabase.from("governance_policy_versions").select("id,version_number").eq("governance_policy_id", input.policyId).eq("version_status", "published").maybeSingle();
  if (published?.id) {
    await supabase.from("governance_policy_versions").update({ version_status: "superseded", effective_to: nowIso(), superseded_by_version_id: input.versionId }).eq("id", published.id);
  }

  // Publish target version (immutable by convention: UI will block edits; DB cannot fully prevent updates without more policy)
  const { error } = await supabase
    .from("governance_policy_versions")
    .update({ version_status: "published", published_by: user.id, published_at: nowIso() })
    .eq("id", input.versionId);
  if (error) return { ok: false as const, error: error.message };

  await supabase.from("governance_policies").update({ status: "published", current_version_number: ver.version_number }).eq("id", input.policyId);
  await supabase.from("policy_adoption_events").insert({
    tenant_id: ws.tenant.id,
    governance_policy_id: input.policyId,
    policy_version_id: input.versionId,
    action_code: "published",
    summary: `Published policy version ${ver.version_number}.`,
    actor_user_id: user.id,
    metadata: { supersededVersionId: published?.id ?? null },
  });

  return { ok: true as const };
}

export async function rollbackPolicyToVersion(input: { policyId: string; toPublishedVersionId: string; reason: string }) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();

  const { data: toV } = await supabase.from("governance_policy_versions").select("*").eq("id", input.toPublishedVersionId).eq("governance_policy_id", input.policyId).maybeSingle();
  if (!toV) return { ok: false as const, error: "Target version not found" };
  if (toV.version_status !== "published") return { ok: false as const, error: "Rollback target must be a published version." };

  // No-op: already current published
  await supabase.from("policy_adoption_events").insert({
    tenant_id: ws.tenant.id,
    governance_policy_id: input.policyId,
    policy_version_id: input.toPublishedVersionId,
    action_code: "rolled_back",
    summary: `Rollback recorded: ${input.reason}`,
    actor_user_id: user.id,
    metadata: { reason: input.reason },
  });

  return { ok: true as const };
}

