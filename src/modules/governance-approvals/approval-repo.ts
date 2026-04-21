import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ApprovalActionRow, ApprovalRequestRow, ApprovalStageRow, ExecutionJobRow } from "./types";

function mapRequest(r: any): ApprovalRequestRow {
  return {
    id: String(r.id),
    tenantId: String(r.tenant_id),
    approvalPolicyCode: String(r.approval_policy_code),
    permissionKey: String(r.permission_key),
    actionCode: String(r.action_code),
    moduleCode: String(r.module_code),
    entityType: String(r.entity_type),
    entityId: (r.entity_id as string | null) ?? null,
    requestingUserId: String(r.requesting_user_id),
    requestingRoleCode: (r.requesting_role_code as string | null) ?? null,
    branchId: (r.branch_id as string | null) ?? null,
    warehouseId: (r.warehouse_id as string | null) ?? null,
    terminalId: (r.terminal_id as string | null) ?? null,
    reason: (r.reason as string | null) ?? null,
    payloadJson: (r.payload_json as Record<string, unknown> | null) ?? {},
    status: r.status,
    riskLevel: r.risk_level,
    dueAt: (r.due_at as string | null) ?? null,
    expiresAt: (r.expires_at as string | null) ?? null,
    approvedAt: (r.approved_at as string | null) ?? null,
    rejectedAt: (r.rejected_at as string | null) ?? null,
    executedAt: (r.executed_at as string | null) ?? null,
    cancelledAt: (r.cancelled_at as string | null) ?? null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function mapStage(s: any): ApprovalStageRow {
  return {
    id: String(s.id),
    approvalRequestId: String(s.approval_request_id),
    stageOrder: Number(s.stage_order),
    stageCode: String(s.stage_code),
    approverType: s.approver_type,
    approverRoleCode: (s.approver_role_code as string | null) ?? null,
    approverUserId: (s.approver_user_id as string | null) ?? null,
    approverScopeJson: (s.approver_scope_json as Record<string, unknown> | null) ?? null,
    requiredApprovalsCount: Number(s.required_approvals_count),
    status: s.status,
    dueAt: (s.due_at as string | null) ?? null,
    completedAt: (s.completed_at as string | null) ?? null,
    createdAt: String(s.created_at),
  };
}

function mapAction(a: any): ApprovalActionRow {
  return {
    id: String(a.id),
    approvalRequestId: String(a.approval_request_id),
    approvalRequestStageId: String(a.approval_request_stage_id),
    actorUserId: (a.actor_user_id as string | null) ?? null,
    action: a.action,
    comment: (a.comment as string | null) ?? null,
    metadata: (a.metadata as Record<string, unknown> | null) ?? {},
    createdAt: String(a.created_at),
  };
}

function mapJob(j: any): ExecutionJobRow {
  return {
    id: String(j.id),
    approvalRequestId: String(j.approval_request_id),
    executionKey: String(j.execution_key),
    status: j.status,
    handlerCode: String(j.handler_code),
    payloadJson: (j.payload_json as Record<string, unknown> | null) ?? {},
    resultJson: (j.result_json as Record<string, unknown> | null) ?? null,
    lastError: (j.last_error as string | null) ?? null,
    createdAt: String(j.created_at),
    updatedAt: String(j.updated_at),
  };
}

export async function repoEnabled(): Promise<boolean> {
  return isSupabaseConfigured();
}

export async function insertApprovalRequest(input: {
  tenantId: string;
  approvalPolicyCode: string;
  permissionKey: string;
  actionCode: string;
  moduleCode: string;
  entityType: string;
  entityId: string | null;
  requestingUserId: string;
  requestingRoleCode?: string | null;
  branchId?: string | null;
  warehouseId?: string | null;
  terminalId?: string | null;
  reason?: string | null;
  payloadJson?: Record<string, unknown>;
  status: "pending" | "draft";
  riskLevel: "low" | "medium" | "high" | "critical";
  dueAt?: string | null;
  expiresAt?: string | null;
}): Promise<{ ok: true; request: ApprovalRequestRow } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("approval_requests")
    .insert({
      tenant_id: input.tenantId,
      approval_policy_code: input.approvalPolicyCode,
      permission_key: input.permissionKey,
      action_code: input.actionCode,
      module_code: input.moduleCode,
      entity_type: input.entityType,
      entity_id: input.entityId,
      requesting_user_id: input.requestingUserId,
      requesting_role_code: input.requestingRoleCode ?? null,
      branch_id: input.branchId ?? null,
      warehouse_id: input.warehouseId ?? null,
      terminal_id: input.terminalId ?? null,
      reason: input.reason ?? null,
      payload_json: input.payloadJson ?? {},
      status: input.status,
      risk_level: input.riskLevel,
      due_at: input.dueAt ?? null,
      expires_at: input.expiresAt ?? null,
    })
    .select("*")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed" };
  return { ok: true, request: mapRequest(data) };
}

export async function insertStages(stages: Array<Omit<ApprovalStageRow, "id" | "createdAt">>): Promise<{ ok: true; stages: ApprovalStageRow[] } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("approval_request_stages")
    .insert(
      stages.map((s) => ({
        approval_request_id: s.approvalRequestId,
        stage_order: s.stageOrder,
        stage_code: s.stageCode,
        approver_type: s.approverType,
        approver_role_code: s.approverRoleCode,
        approver_user_id: s.approverUserId,
        approver_scope_json: s.approverScopeJson ?? null,
        required_approvals_count: s.requiredApprovalsCount,
        status: s.status,
        due_at: s.dueAt ?? null,
        completed_at: s.completedAt ?? null,
      })),
    )
    .select("*");
  if (error || !data) return { ok: false, error: error?.message ?? "Insert stages failed" };
  return { ok: true, stages: (data as any[]).map(mapStage) };
}

export async function listPendingRequests(tenantId: string, limit = 200): Promise<ApprovalRequestRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("approval_requests")
    .select("*")
    .eq("tenant_id", tenantId)
    .in("status", ["pending", "partially_approved", "escalated"])
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map(mapRequest);
}

export async function getRequestBundle(tenantId: string, requestId: string): Promise<{ request: ApprovalRequestRow; stages: ApprovalStageRow[]; actions: ApprovalActionRow[]; jobs: ExecutionJobRow[] } | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabaseClient();
  const [{ data: req }, { data: stages }, { data: actions }, { data: jobs }] = await Promise.all([
    supabase.from("approval_requests").select("*").eq("tenant_id", tenantId).eq("id", requestId).maybeSingle(),
    supabase.from("approval_request_stages").select("*").eq("approval_request_id", requestId).order("stage_order", { ascending: true }),
    supabase.from("approval_stage_actions").select("*").eq("approval_request_id", requestId).order("created_at", { ascending: true }),
    supabase.from("approval_execution_jobs").select("*").eq("approval_request_id", requestId).order("created_at", { ascending: true }),
  ]);
  if (!req) return null;
  return {
    request: mapRequest(req),
    stages: (stages ?? []).map(mapStage),
    actions: (actions ?? []).map(mapAction),
    jobs: (jobs ?? []).map(mapJob),
  };
}

export async function appendStageAction(input: {
  approvalRequestId: string;
  approvalRequestStageId: string;
  actorUserId: string | null;
  action: string;
  comment?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{ ok: true; row: ApprovalActionRow } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("approval_stage_actions")
    .insert({
      approval_request_id: input.approvalRequestId,
      approval_request_stage_id: input.approvalRequestStageId,
      actor_user_id: input.actorUserId,
      action: input.action,
      comment: input.comment ?? null,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Insert action failed" };
  return { ok: true, row: mapAction(data) };
}

export async function updateStage(input: { stageId: string; patch: Partial<{ status: string; completedAt: string | null; dueAt: string | null; approverUserId: string | null; approverRoleCode: string | null }> }) {
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("approval_request_stages")
    .update({
      status: input.patch.status,
      completed_at: input.patch.completedAt,
      due_at: input.patch.dueAt,
      approver_user_id: input.patch.approverUserId,
      approver_role_code: input.patch.approverRoleCode,
    })
    .eq("id", input.stageId)
    .select("*")
    .single();
  if (error || !data) return { ok: false as const, error: error?.message ?? "Update stage failed" };
  return { ok: true as const, stage: mapStage(data) };
}

export async function updateRequest(input: { tenantId: string; requestId: string; patch: Partial<{ status: string; approvedAt: string | null; rejectedAt: string | null; cancelledAt: string | null; executedAt: string | null; dueAt: string | null; expiresAt: string | null }> }) {
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("approval_requests")
    .update({
      status: input.patch.status,
      approved_at: input.patch.approvedAt,
      rejected_at: input.patch.rejectedAt,
      cancelled_at: input.patch.cancelledAt,
      executed_at: input.patch.executedAt,
      due_at: input.patch.dueAt,
      expires_at: input.patch.expiresAt,
    })
    .eq("tenant_id", input.tenantId)
    .eq("id", input.requestId)
    .select("*")
    .single();
  if (error || !data) return { ok: false as const, error: error?.message ?? "Update request failed" };
  return { ok: true as const, request: mapRequest(data) };
}

export async function upsertExecutionJob(input: {
  approvalRequestId: string;
  executionKey: string;
  status: string;
  handlerCode: string;
  payloadJson: Record<string, unknown>;
}): Promise<{ ok: true; job: ExecutionJobRow } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("approval_execution_jobs")
    .upsert(
      {
        approval_request_id: input.approvalRequestId,
        execution_key: input.executionKey,
        status: input.status,
        handler_code: input.handlerCode,
        payload_json: input.payloadJson,
      },
      { onConflict: "approval_request_id,execution_key" },
    )
    .select("*")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Upsert job failed" };
  return { ok: true, job: mapJob(data) };
}

export async function updateExecutionJob(input: { jobId: string; patch: Partial<{ status: string; resultJson: Record<string, unknown> | null; lastError: string | null }> }) {
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("approval_execution_jobs")
    .update({
      status: input.patch.status,
      result_json: input.patch.resultJson,
      last_error: input.patch.lastError,
    })
    .eq("id", input.jobId)
    .select("*")
    .single();
  if (error || !data) return { ok: false as const, error: error?.message ?? "Update job failed" };
  return { ok: true as const, job: mapJob(data) };
}

