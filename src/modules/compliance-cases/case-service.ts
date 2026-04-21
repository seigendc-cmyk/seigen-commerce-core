import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";
import { routeCase } from "./case-routing.service";
import type { ComplianceCaseRow, ComplianceCaseType, ComplianceOriginSourceType, ComplianceSeverity } from "./types";

function nowIso() {
  return new Date().toISOString();
}

function mapRow(r: any): ComplianceCaseRow {
  return {
    id: String(r.id),
    tenantId: String(r.tenant_id),
    caseCode: String(r.case_code),
    caseType: r.case_type,
    title: String(r.title),
    summary: String(r.summary),
    status: r.status,
    severity: r.severity,
    originSourceType: r.origin_source_type,
    originSourceId: (r.origin_source_id as string | null) ?? null,
    requestingUserId: (r.requesting_user_id as string | null) ?? null,
    assignedToUserId: (r.assigned_to_user_id as string | null) ?? null,
    assignedRoleCode: (r.assigned_role_code as string | null) ?? null,
    branchId: (r.branch_id as string | null) ?? null,
    moduleCode: (r.module_code as string | null) ?? null,
    entityType: (r.entity_type as string | null) ?? null,
    entityId: (r.entity_id as string | null) ?? null,
    riskSummaryJson: (r.risk_summary_json as any) ?? {},
    resolutionSummary: (r.resolution_summary as string | null) ?? null,
    requiresLegalReview: Boolean(r.requires_legal_review),
    requiresExecutiveVisibility: Boolean(r.requires_executive_visibility),
    requiresTrustVisibility: Boolean(r.requires_trust_visibility),
    openedAt: String(r.opened_at),
    resolvedAt: (r.resolved_at as string | null) ?? null,
    closedAt: (r.closed_at as string | null) ?? null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function nextCaseCode(): string {
  const n = Date.now().toString(36).toUpperCase();
  return `CASE-${n}`;
}

export async function createComplianceCase(input: {
  caseType: ComplianceCaseType;
  severity: ComplianceSeverity;
  title: string;
  summary: string;
  originSourceType: ComplianceOriginSourceType;
  originSourceId?: string | null;
  moduleCode?: string | null;
  branchId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  riskSummaryJson?: Record<string, unknown>;
}): Promise<{ ok: true; row: ComplianceCaseRow } | { ok: false; error: string }> {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured" };

  const routing = routeCase({ caseType: input.caseType, severity: input.severity, moduleCode: input.moduleCode ?? null });
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("compliance_cases")
    .insert({
      tenant_id: ws.tenant.id,
      case_code: nextCaseCode(),
      case_type: input.caseType,
      title: input.title,
      summary: input.summary,
      status: "open",
      severity: input.severity,
      origin_source_type: input.originSourceType,
      origin_source_id: input.originSourceId ?? null,
      requesting_user_id: user.id,
      assigned_to_user_id: null,
      assigned_role_code: routing.assignedRoleCode,
      branch_id: input.branchId ?? null,
      module_code: input.moduleCode ?? null,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      risk_summary_json: input.riskSummaryJson ?? {},
      requires_legal_review: routing.requiresLegalReview,
      requires_executive_visibility: routing.requiresExecutiveVisibility,
      requires_trust_visibility: routing.requiresTrustVisibility,
      opened_at: nowIso(),
    })
    .select("*")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed" };

  await supabase.from("compliance_case_events").insert({
    compliance_case_id: data.id,
    event_code: "case.opened",
    title: "Case opened",
    summary: input.summary,
    actor_user_id: user.id,
    metadata: { caseType: input.caseType, severity: input.severity },
  });

  return { ok: true, row: mapRow(data) };
}

export async function listComplianceCases(limit = 200): Promise<{ ok: true; rows: ComplianceCaseRow[] } | { ok: false; error: string }> {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("compliance_cases").select("*").eq("tenant_id", ws.tenant.id).order("opened_at", { ascending: false }).limit(limit);
  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: (data ?? []).map(mapRow) };
}

export async function getComplianceCaseBundle(caseId: string) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const [{ data: row }, { data: links }, { data: events }] = await Promise.all([
    supabase.from("compliance_cases").select("*").eq("tenant_id", ws.tenant.id).eq("id", caseId).maybeSingle(),
    supabase.from("compliance_case_links").select("*").eq("compliance_case_id", caseId).order("created_at", { ascending: true }),
    supabase.from("compliance_case_events").select("*").eq("compliance_case_id", caseId).order("created_at", { ascending: true }),
  ]);
  if (!row) return { ok: false as const, error: "Not found" };
  return { ok: true as const, case: mapRow(row), links: links ?? [], events: events ?? [] };
}

export async function resolveCase(input: { caseId: string; resolutionSummary: string }) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("compliance_cases")
    .update({ status: "resolved", resolution_summary: input.resolutionSummary, resolved_at: nowIso() })
    .eq("tenant_id", ws.tenant.id)
    .eq("id", input.caseId);
  if (error) return { ok: false as const, error: error.message };
  await supabase.from("compliance_case_events").insert({
    compliance_case_id: input.caseId,
    event_code: "case.resolved",
    title: "Case resolved",
    summary: input.resolutionSummary,
    actor_user_id: user.id,
  });
  return { ok: true as const };
}

