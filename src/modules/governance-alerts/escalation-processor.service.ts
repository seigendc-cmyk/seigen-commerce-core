import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";
import { upsertGovernanceAlert } from "./governance-alerts.service";

function now() {
  return new Date();
}

/**
 * On-demand escalation processor.
 * In production this should run on a schedule (cron/queue).
 */
export async function processApprovalEscalations(): Promise<{ ok: true; escalated: number } | { ok: false; error: string }> {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured" };

  const supabase = await createServerSupabaseClient();
  const tNow = now().toISOString();

  // Find overdue pending stages
  const { data: stages, error } = await supabase
    .from("approval_request_stages")
    .select("id, approval_request_id, stage_code, stage_order, due_at, status")
    .eq("status", "pending")
    .lt("due_at", tNow)
    .limit(200);

  if (error) return { ok: false, error: error.message };
  let escalated = 0;

  for (const s of (stages ?? []) as any[]) {
    escalated += 1;
    await supabase.from("approval_request_stages").update({ status: "escalated" }).eq("id", s.id);
    await supabase
      .from("approval_escalations")
      .insert({ approval_request_id: s.approval_request_id, from_stage_id: s.id, escalation_rule_code: "stage_overdue_2h", reason: "Stage overdue; escalated by processor." });

    await upsertGovernanceAlert({
      alertCode: "approval.stage.overdue",
      severity: "high",
      title: "Approval stage overdue",
      summary: `Approval stage ${s.stage_code} is overdue and was escalated.`,
      entityType: "approval_request",
      entityId: s.approval_request_id,
      metadata: { stageId: s.id, stageOrder: s.stage_order, dueAt: s.due_at },
      dedupeKey: `approval.stage.overdue:${s.id}`,
    });
  }

  return { ok: true, escalated };
}

