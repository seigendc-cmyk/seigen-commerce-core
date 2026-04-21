import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";
import { getRegulatorConnectorAdapter } from "./connector-registry.service";
import type { ConnectorRunInput, ConnectorRunMode } from "./connector-contracts";

export async function listRegulatorConnectors(limit = 200) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!user) return { ok: false as const, error: "Not signed in" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const tenantId = ws?.tenant?.id ?? null;
  const q = supabase.from("regulator_connectors").select("*").order("updated_at", { ascending: false }).limit(limit);
  if (tenantId) q.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
  const { data, error } = await q;
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, rows: data ?? [] };
}

export async function runRegulatorConnector(input: {
  connectorCode: string;
  eventType: string;
  direction: "outbound" | "inbound";
  referenceCode?: string | null;
  payload: Record<string, unknown>;
  mode: ConnectorRunMode;
}): Promise<{ ok: true; runId: string } | { ok: false; error: string }> {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();

  // Registry row must be active for tenant (or global public via RLS).
  const { data: reg } = await supabase
    .from("regulator_connectors")
    .select("*")
    .or(`tenant_id.eq.${ws.tenant.id},tenant_id.is.null`)
    .eq("connector_code", input.connectorCode)
    .eq("status", "active")
    .maybeSingle();
  if (!reg) return { ok: false, error: "Connector not found or disabled." };

  const adapter = getRegulatorConnectorAdapter(input.connectorCode);
  if (!adapter) return { ok: false, error: "Connector adapter not configured in app." };
  if (!adapter.supportedEvents.includes(input.eventType)) return { ok: false, error: "Connector does not support this event type." };

  const ins = await supabase
    .from("regulator_connector_runs")
    .insert({
      tenant_id: ws.tenant.id,
      connector_code: input.connectorCode,
      event_type: input.eventType,
      direction: input.direction,
      status: input.mode === "dry_run" ? "dry_run" : "pending",
      reference_code: input.referenceCode ?? null,
      payload_json: input.payload,
      is_dry_run: input.mode === "dry_run",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (ins.error || !ins.data) return { ok: false, error: ins.error?.message ?? "Insert failed" };
  const runId = String(ins.data.id);

  const runInput: ConnectorRunInput = {
    connectorCode: input.connectorCode,
    eventType: input.eventType,
    direction: input.direction,
    referenceCode: input.referenceCode ?? null,
    payload: input.payload,
    mode: input.mode,
  };

  const res = await adapter.run(
    { tenantId: ws.tenant.id, actorUserId: user.id, regionCode: reg.region_code ?? null, countryCode: reg.country_code ?? null },
    runInput,
  );

  if (!res.ok) {
    await supabase
      .from("regulator_connector_runs")
      .update({ status: "failed", error_message: res.error, response_json: res.response ?? { error: res.error } })
      .eq("tenant_id", ws.tenant.id)
      .eq("id", runId);
    return { ok: false, error: res.error };
  }

  await supabase
    .from("regulator_connector_runs")
    .update({ status: res.status, response_json: res.response ?? {} })
    .eq("tenant_id", ws.tenant.id)
    .eq("id", runId);

  return { ok: true, runId };
}

export async function listConnectorRuns(input: { connectorCode?: string | null; limit?: number }) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const limit = input.limit ?? 200;
  const q = supabase.from("regulator_connector_runs").select("*").eq("tenant_id", ws.tenant.id).order("created_at", { ascending: false }).limit(limit);
  if (input.connectorCode) q.eq("connector_code", input.connectorCode);
  const { data, error } = await q;
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, rows: data ?? [] };
}

