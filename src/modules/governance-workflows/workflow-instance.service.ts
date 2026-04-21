import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { WorkflowInstanceRow, WorkflowLinkRow, WorkflowStepRow, WorkflowTimelineEventRow } from "./types";

function mapWorkflow(w: any): WorkflowInstanceRow {
  return {
    id: String(w.id),
    tenantId: String(w.tenant_id),
    workflowCode: String(w.workflow_code),
    title: String(w.title),
    description: (w.description as string | null) ?? null,
    originModuleCode: String(w.origin_module_code),
    originPermissionKey: String(w.origin_permission_key),
    originActionCode: String(w.origin_action_code),
    originEntityType: String(w.origin_entity_type),
    originEntityId: (w.origin_entity_id as string | null) ?? null,
    requestingUserId: String(w.requesting_user_id),
    branchId: (w.branch_id as string | null) ?? null,
    warehouseId: (w.warehouse_id as string | null) ?? null,
    terminalId: (w.terminal_id as string | null) ?? null,
    status: w.status,
    riskLevel: w.risk_level,
    executiveVisible: Boolean(w.executive_visible),
    trustVisible: Boolean(w.trust_visible),
    impactSummaryJson: (w.impact_summary_json as any) ?? {},
    payloadJson: (w.payload_json as any) ?? {},
    startedAt: String(w.started_at),
    completedAt: (w.completed_at as string | null) ?? null,
    createdAt: String(w.created_at),
    updatedAt: String(w.updated_at),
  };
}

function mapStep(s: any): WorkflowStepRow {
  return {
    id: String(s.id),
    governanceWorkflowId: String(s.governance_workflow_id),
    stepOrder: Number(s.step_order),
    stepCode: String(s.step_code),
    stepType: s.step_type,
    moduleCode: String(s.module_code),
    status: s.status,
    assignedToUserId: (s.assigned_to_user_id as string | null) ?? null,
    assignedToRoleCode: (s.assigned_to_role_code as string | null) ?? null,
    assignedScopeJson: (s.assigned_scope_json as any) ?? null,
    dependsOnStepId: (s.depends_on_step_id as string | null) ?? null,
    payloadJson: (s.payload_json as any) ?? {},
    startedAt: (s.started_at as string | null) ?? null,
    completedAt: (s.completed_at as string | null) ?? null,
    createdAt: String(s.created_at),
  };
}

function mapLink(l: any): WorkflowLinkRow {
  return {
    id: String(l.id),
    governanceWorkflowId: String(l.governance_workflow_id),
    linkType: l.link_type,
    linkedId: String(l.linked_id),
    linkedCode: (l.linked_code as string | null) ?? null,
    metadata: (l.metadata as any) ?? {},
    createdAt: String(l.created_at),
  };
}

function mapTimeline(e: any): WorkflowTimelineEventRow {
  return {
    id: String(e.id),
    governanceWorkflowId: String(e.governance_workflow_id),
    eventCode: String(e.event_code),
    title: String(e.title),
    summary: String(e.summary),
    actorUserId: (e.actor_user_id as string | null) ?? null,
    metadata: (e.metadata as any) ?? {},
    createdAt: String(e.created_at),
  };
}

export async function createWorkflow(input: {
  tenantId: string;
  workflowCode: string;
  title: string;
  description?: string | null;
  originModuleCode: string;
  originPermissionKey: string;
  originActionCode: string;
  originEntityType: string;
  originEntityId?: string | null;
  requestingUserId: string;
  branchId?: string | null;
  warehouseId?: string | null;
  terminalId?: string | null;
  status: string;
  riskLevel: string;
  executiveVisible?: boolean;
  trustVisible?: boolean;
  impactSummaryJson?: Record<string, unknown>;
  payloadJson?: Record<string, unknown>;
}): Promise<{ ok: true; workflow: WorkflowInstanceRow } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("governance_workflows")
    .insert({
      tenant_id: input.tenantId,
      workflow_code: input.workflowCode,
      title: input.title,
      description: input.description ?? null,
      origin_module_code: input.originModuleCode,
      origin_permission_key: input.originPermissionKey,
      origin_action_code: input.originActionCode,
      origin_entity_type: input.originEntityType,
      origin_entity_id: input.originEntityId ?? null,
      requesting_user_id: input.requestingUserId,
      branch_id: input.branchId ?? null,
      warehouse_id: input.warehouseId ?? null,
      terminal_id: input.terminalId ?? null,
      status: input.status,
      risk_level: input.riskLevel,
      executive_visible: input.executiveVisible ?? false,
      trust_visible: input.trustVisible ?? false,
      impact_summary_json: input.impactSummaryJson ?? {},
      payload_json: input.payloadJson ?? {},
    })
    .select("*")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed" };
  return { ok: true, workflow: mapWorkflow(data) };
}

export async function insertWorkflowSteps(steps: Array<Omit<WorkflowStepRow, "id" | "createdAt">>) {
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("governance_workflow_steps")
    .insert(
      steps.map((s) => ({
        governance_workflow_id: s.governanceWorkflowId,
        step_order: s.stepOrder,
        step_code: s.stepCode,
        step_type: s.stepType,
        module_code: s.moduleCode,
        status: s.status,
        assigned_to_user_id: s.assignedToUserId,
        assigned_to_role_code: s.assignedToRoleCode,
        assigned_scope_json: s.assignedScopeJson ?? null,
        depends_on_step_id: s.dependsOnStepId ?? null,
        payload_json: s.payloadJson ?? {},
        started_at: s.startedAt ?? null,
        completed_at: s.completedAt ?? null,
      })),
    )
    .select("*");
  if (error || !data) return { ok: false as const, error: error.message };
  return { ok: true as const, steps: (data as any[]).map(mapStep) };
}

export async function insertWorkflowLink(input: { workflowId: string; linkType: string; linkedId: string; linkedCode?: string | null; metadata?: Record<string, unknown> }) {
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("governance_workflow_links")
    .insert({
      governance_workflow_id: input.workflowId,
      link_type: input.linkType,
      linked_id: input.linkedId,
      linked_code: input.linkedCode ?? null,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();
  if (error || !data) return { ok: false as const, error: error.message };
  return { ok: true as const, link: mapLink(data) };
}

export async function insertTimelineEvent(input: { workflowId: string; eventCode: string; title: string; summary: string; actorUserId?: string | null; metadata?: Record<string, unknown> }) {
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("governance_workflow_timeline_events")
    .insert({
      governance_workflow_id: input.workflowId,
      event_code: input.eventCode,
      title: input.title,
      summary: input.summary,
      actor_user_id: input.actorUserId ?? null,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();
  if (error || !data) return { ok: false as const, error: error.message };
  return { ok: true as const, event: mapTimeline(data) };
}

export async function listWorkflows(tenantId: string, limit = 200): Promise<WorkflowInstanceRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("governance_workflows").select("*").eq("tenant_id", tenantId).order("started_at", { ascending: false }).limit(limit);
  return (data ?? []).map(mapWorkflow);
}

export async function getWorkflowDetails(tenantId: string, workflowId: string): Promise<{ workflow: WorkflowInstanceRow; steps: WorkflowStepRow[]; links: WorkflowLinkRow[]; timeline: WorkflowTimelineEventRow[] } | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabaseClient();
  const [{ data: wf }, { data: steps }, { data: links }, { data: timeline }] = await Promise.all([
    supabase.from("governance_workflows").select("*").eq("tenant_id", tenantId).eq("id", workflowId).maybeSingle(),
    supabase.from("governance_workflow_steps").select("*").eq("governance_workflow_id", workflowId).order("step_order", { ascending: true }),
    supabase.from("governance_workflow_links").select("*").eq("governance_workflow_id", workflowId).order("created_at", { ascending: true }),
    supabase.from("governance_workflow_timeline_events").select("*").eq("governance_workflow_id", workflowId).order("created_at", { ascending: true }),
  ]);
  if (!wf) return null;
  return { workflow: mapWorkflow(wf), steps: (steps ?? []).map(mapStep), links: (links ?? []).map(mapLink), timeline: (timeline ?? []).map(mapTimeline) };
}

