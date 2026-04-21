import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";
import { getAdapter } from "./compliance-export-adapter";

export async function createOutboundComplianceEvent(input: {
  adapterCode: string;
  eventType: string;
  referenceCode?: string | null;
  payloadJson: Record<string, unknown>;
  relatedCaseId?: string | null;
  relatedBundleId?: string | null;
}) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("external_compliance_events")
    .insert({
      tenant_id: ws.tenant.id,
      adapter_code: input.adapterCode,
      event_type: input.eventType,
      direction: "outbound",
      status: "pending",
      reference_code: input.referenceCode ?? null,
      payload_json: input.payloadJson,
      related_case_id: input.relatedCaseId ?? null,
      related_bundle_id: input.relatedBundleId ?? null,
    })
    .select("*")
    .single();
  if (error || !data) return { ok: false as const, error: error?.message ?? "Insert failed" };
  return { ok: true as const, event: data };
}

export async function sendOutboundComplianceEvent(eventId: string) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };

  const supabase = await createServerSupabaseClient();
  const { data: ev } = await supabase.from("external_compliance_events").select("*").eq("tenant_id", ws.tenant.id).eq("id", eventId).maybeSingle();
  if (!ev) return { ok: false as const, error: "Event not found" };
  const adapter = getAdapter(String(ev.adapter_code));
  if (!adapter) return { ok: false as const, error: "Adapter not configured" };

  const res = await adapter.sendOutbound(ev.payload_json ?? {});
  if (!res.ok) {
    await supabase.from("external_compliance_events").update({ status: "failed", response_json: res.response ?? { error: res.error } }).eq("id", eventId);
    return { ok: false as const, error: res.error };
  }
  await supabase.from("external_compliance_events").update({ status: "sent", response_json: res.response ?? {} }).eq("id", eventId);
  return { ok: true as const };
}

export async function listExternalComplianceEvents(limit = 200) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("external_compliance_events").select("*").eq("tenant_id", ws.tenant.id).order("created_at", { ascending: false }).limit(limit);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, rows: data ?? [] };
}

