import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";
import { createComplianceCase } from "@/modules/compliance-cases/case-service";
import { ANOMALY_RULES } from "./anomaly-rule-registry";

function sinceIso(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60_000).toISOString();
}

export async function runAnomalyDetection(): Promise<{ ok: true; created: number } | { ok: false; error: string }> {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();

  let created = 0;

  // Rule: failed supervisor passcode attempts
  {
    const rule = ANOMALY_RULES.find((r) => r.code === "stepup.failed_supervisor_passcode")!;
    const { data } = await supabase
      .from("step_up_events")
      .select("user_id")
      .eq("tenant_id", ws.tenant.id)
      .eq("step_up_policy_code", "supervisor_passcode")
      .eq("status", "failed")
      .gte("created_at", sinceIso(rule.windowDays))
      .limit(5000);
    const counts = new Map<string, number>();
    for (const row of (data ?? []) as any[]) counts.set(row.user_id, (counts.get(row.user_id) ?? 0) + 1);
    for (const [userId, c] of counts) {
      if (c < rule.threshold) continue;
      const { data: existing } = await supabase
        .from("governance_anomalies")
        .select("id")
        .eq("tenant_id", ws.tenant.id)
        .eq("anomaly_code", rule.code)
        .contains("source_metric_json", { userId })
        .limit(1);
      if (existing && existing.length > 0) continue;

      const ins = await supabase.from("governance_anomalies").insert({
        tenant_id: ws.tenant.id,
        anomaly_code: rule.code,
        title: rule.title,
        summary: `Detected ${c} failed supervisor passcode attempts in the last ${rule.windowDays} days.`,
        severity: rule.severity,
        score: c,
        status: "open",
        related_user_id: userId,
        source_metric_json: { userId, count: c, windowDays: rule.windowDays },
      });
      if (!ins.error) created += 1;

      // Convert severe anomalies into a compliance case automatically (high+)
      await createComplianceCase({
        caseType: "security_incident",
        severity: "high",
        title: "Supervisor passcode failures investigation",
        summary: `Auto-opened case: ${c} failed supervisor passcode attempts detected.`,
        originSourceType: "anomaly",
        originSourceId: `${rule.code}:${userId}`,
        moduleCode: "security",
        riskSummaryJson: { anomalyCode: rule.code, userId, count: c },
      });
    }
  }

  return { ok: true, created };
}

export async function listAnomalies(limit = 200) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("governance_anomalies").select("*").eq("tenant_id", ws.tenant.id).order("created_at", { ascending: false }).limit(limit);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, rows: data ?? [] };
}

export async function convertAnomalyToCase(input: { anomalyId: string }) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const { data: a } = await supabase.from("governance_anomalies").select("*").eq("tenant_id", ws.tenant.id).eq("id", input.anomalyId).maybeSingle();
  if (!a) return { ok: false as const, error: "Anomaly not found" };

  const c = await createComplianceCase({
    caseType: "override_abuse",
    severity: "high",
    title: `Investigation: ${a.title}`,
    summary: a.summary,
    originSourceType: "anomaly",
    originSourceId: a.id,
    moduleCode: a.module_code ?? null,
    branchId: a.branch_id ?? null,
    riskSummaryJson: a.source_metric_json ?? {},
  });
  if (!c.ok) return c;

  await supabase.from("governance_anomalies").update({ status: "converted_to_case" }).eq("tenant_id", ws.tenant.id).eq("id", input.anomalyId);
  return { ok: true as const, caseId: c.row.id };
}

