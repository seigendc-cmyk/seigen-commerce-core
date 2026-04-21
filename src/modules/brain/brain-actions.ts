"use server";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Sale } from "@/modules/pos/types/pos";
import { BrainEventTypes, type BrainEventSeverity } from "./types/brain-event";

export type EmitBrainEventResult =
  | { ok: true; id: string }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; error: string };

export type BrainEventRow = {
  id: string;
  event_type: string;
  module: string;
  tenant_id: string | null;
  branch_id: string | null;
  actor_id: string | null;
  actor_type: string;
  entity_type: string;
  entity_id: string;
  occurred_at: string;
  severity: BrainEventSeverity;
  correlation_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

export type ListBrainEventsInput = {
  module?: string;
  eventType?: string;
  tenantId?: string;
  from?: string;
  to?: string;
  limit?: number;
};

export type ListBrainEventsResult =
  | { ok: true; events: BrainEventRow[] }
  | { ok: false; error: string };

/**
 * Record a completed POS sale — primary vertical slice for Brain memory.
 */
export async function emitPosSaleCompletedBrainEvent(input: {
  sale: Sale;
  correlationId: string;
}): Promise<EmitBrainEventResult> {
  if (!isSupabaseConfigured()) {
    return { ok: true, skipped: true, reason: "Supabase not configured" };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: true, skipped: true, reason: "No authenticated user" };
  }

  const { data: membership } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.tenant_id) {
    return { ok: true, skipped: true, reason: "No workspace (tenant)" };
  }

  const s = input.sale;
  const payload = {
    receiptNumber: s.receiptNumber,
    saleId: s.id,
    branchId: s.branchId,
    status: s.status,
    subtotal: s.subtotal,
    deliveryFee: s.deliveryFee,
    amountDue: s.amountDue,
    totalPaid: s.totalPaid,
    changeDue: s.changeDue,
    lineCount: s.lines.length,
    lines: s.lines.slice(0, 80).map((l) => ({
      productId: l.productId,
      sku: l.sku,
      name: l.name,
      qty: l.qty,
      lineTotal: l.lineTotal,
    })),
    payments: s.payments.map((p) => ({ method: p.method, amount: p.amount })),
    ideliverProviderId: s.ideliverProviderId,
  };

  const { data, error } = await supabase
    .from("brain_events")
    .insert({
      event_type: BrainEventTypes.POS_SALE_COMPLETED,
      module: "pos",
      tenant_id: membership.tenant_id as string,
      branch_id: s.branchId,
      actor_id: user.id,
      actor_type: "user",
      entity_type: "sale",
      entity_id: s.id,
      occurred_at: s.createdAt,
      severity: "info",
      correlation_id: input.correlationId,
      payload,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, id: data.id as string };
}

/**
 * COGS Reserves used to pay suppliers — surfaces in Brain for finance / managers.
 */
export async function emitCreditorPaymentBrainEvent(input: {
  batchId: string;
  total: number;
  branchId: string;
  correlationId: string;
  allocations: Array<{ supplierId: string; supplierName: string; amount: number }>;
}): Promise<EmitBrainEventResult> {
  if (!isSupabaseConfigured()) {
    return { ok: true, skipped: true, reason: "Supabase not configured" };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: true, skipped: true, reason: "No authenticated user" };
  }

  const { data: membership } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.tenant_id) {
    return { ok: true, skipped: true, reason: "No workspace (tenant)" };
  }

  const payload = {
    batchId: input.batchId,
    total: input.total,
    branchId: input.branchId,
    supplierCount: input.allocations.length,
    allocations: input.allocations.map((a) => ({
      supplierId: a.supplierId,
      supplierName: a.supplierName,
      amount: a.amount,
    })),
  };

  const { data, error } = await supabase
    .from("brain_events")
    .insert({
      event_type: BrainEventTypes.CASHPLAN_CREDITOR_PAYMENT,
      module: "cashplan",
      tenant_id: membership.tenant_id as string,
      branch_id: input.branchId,
      actor_id: user.id,
      actor_type: "user",
      entity_type: "creditor_payment_batch",
      entity_id: input.batchId,
      occurred_at: new Date().toISOString(),
      severity: "notice" as BrainEventSeverity,
      correlation_id: input.correlationId,
      payload,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, id: data.id as string };
}

export async function emitCashPlanScheduleChangeRequestedBrainEvent(input: {
  requestId: string;
  kind: "creditor" | "debtor";
  entityId: string;
  entityName: string;
  proposedDateIso: string;
  previousDateKey?: string;
  branchId: string;
  correlationId: string;
}): Promise<EmitBrainEventResult> {
  if (!isSupabaseConfigured()) {
    return { ok: true, skipped: true, reason: "Supabase not configured" };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: true, skipped: true, reason: "No authenticated user" };
  }

  const { data: membership } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.tenant_id) {
    return { ok: true, skipped: true, reason: "No workspace (tenant)" };
  }

  const payload = {
    requestId: input.requestId,
    kind: input.kind,
    entityId: input.entityId,
    entityName: input.entityName,
    proposedDateIso: input.proposedDateIso,
    previousDateKey: input.previousDateKey,
    missed: true,
  };

  const { data, error } = await supabase
    .from("brain_events")
    .insert({
      event_type: BrainEventTypes.CASHPLAN_SCHEDULE_CHANGE_REQUESTED,
      module: "cashplan",
      tenant_id: membership.tenant_id as string,
      branch_id: input.branchId,
      actor_id: user.id,
      actor_type: "user",
      entity_type: "schedule_change_request",
      entity_id: input.requestId,
      occurred_at: new Date().toISOString(),
      severity: "warning" as BrainEventSeverity,
      correlation_id: input.correlationId,
      payload,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, id: data.id as string };
}

export async function emitCashPlanScheduleChangeResolvedBrainEvent(input: {
  requestId: string;
  kind: "creditor" | "debtor";
  entityId: string;
  entityName: string;
  resolution: "approved" | "rejected";
  proposedDateIso: string;
  branchId: string;
  correlationId: string;
}): Promise<EmitBrainEventResult> {
  if (!isSupabaseConfigured()) {
    return { ok: true, skipped: true, reason: "Supabase not configured" };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: true, skipped: true, reason: "No authenticated user" };
  }

  const { data: membership } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.tenant_id) {
    return { ok: true, skipped: true, reason: "No workspace (tenant)" };
  }

  const payload = {
    requestId: input.requestId,
    kind: input.kind,
    entityId: input.entityId,
    entityName: input.entityName,
    resolution: input.resolution,
    proposedDateIso: input.proposedDateIso,
  };

  const { data, error } = await supabase
    .from("brain_events")
    .insert({
      event_type: BrainEventTypes.CASHPLAN_SCHEDULE_CHANGE_RESOLVED,
      module: "cashplan",
      tenant_id: membership.tenant_id as string,
      branch_id: input.branchId,
      actor_id: user.id,
      actor_type: "user",
      entity_type: "schedule_change_request",
      entity_id: input.requestId,
      occurred_at: new Date().toISOString(),
      severity: (input.resolution === "approved" ? "notice" : "info") as BrainEventSeverity,
      correlation_id: input.correlationId,
      payload,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, id: data.id as string };
}

export async function emitConsignmentAgreementApprovalRequestedBrainEvent(input: {
  requestId: string;
  documentId: string;
  agentName: string;
  agentEmail: string;
  principalBranchId: string;
  premiumPercent: number;
  correlationId: string;
}): Promise<EmitBrainEventResult> {
  if (!isSupabaseConfigured()) {
    return { ok: true, skipped: true, reason: "Supabase not configured" };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: true, skipped: true, reason: "No authenticated user" };
  }

  const { data: membership } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.tenant_id) {
    return { ok: true, skipped: true, reason: "No workspace (tenant)" };
  }

  const payload = {
    requestId: input.requestId,
    documentId: input.documentId,
    agentName: input.agentName,
    agentEmail: input.agentEmail,
    principalBranchId: input.principalBranchId,
    premiumPercent: input.premiumPercent,
  };

  const { data, error } = await supabase
    .from("brain_events")
    .insert({
      event_type: BrainEventTypes.CONSIGNMENT_AGREEMENT_APPROVAL_REQUESTED,
      module: "consignment",
      tenant_id: membership.tenant_id as string,
      branch_id: input.principalBranchId,
      actor_id: user.id,
      actor_type: "user",
      entity_type: "consignment_agreement_request",
      entity_id: input.requestId,
      occurred_at: new Date().toISOString(),
      severity: "notice" as BrainEventSeverity,
      correlation_id: input.correlationId,
      payload,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, id: data.id as string };
}

export async function emitConsignmentAgreementApprovalResolvedBrainEvent(input: {
  requestId: string;
  documentId: string;
  resolution: "approved" | "rejected";
  principalBranchId: string;
  agreementId?: string;
  stallBranchId?: string;
  agentUserId?: string;
  correlationId: string;
}): Promise<EmitBrainEventResult> {
  if (!isSupabaseConfigured()) {
    return { ok: true, skipped: true, reason: "Supabase not configured" };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: true, skipped: true, reason: "No authenticated user" };
  }

  const { data: membership } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.tenant_id) {
    return { ok: true, skipped: true, reason: "No workspace (tenant)" };
  }

  const payload = {
    requestId: input.requestId,
    documentId: input.documentId,
    resolution: input.resolution,
    agreementId: input.agreementId ?? null,
    stallBranchId: input.stallBranchId ?? null,
    agentUserId: input.agentUserId ?? null,
  };

  const { data, error } = await supabase
    .from("brain_events")
    .insert({
      event_type: BrainEventTypes.CONSIGNMENT_AGREEMENT_APPROVAL_RESOLVED,
      module: "consignment",
      tenant_id: membership.tenant_id as string,
      branch_id: input.principalBranchId,
      actor_id: user.id,
      actor_type: "user",
      entity_type: "consignment_agreement_request",
      entity_id: input.requestId,
      occurred_at: new Date().toISOString(),
      severity: (input.resolution === "approved" ? "notice" : "info") as BrainEventSeverity,
      correlation_id: input.correlationId,
      payload,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, id: data.id as string };
}

export async function emitConsignmentAgentAccessCodeIssuedBrainEvent(input: {
  provisioningId: string;
  accessCodeId: string;
  principalBranchId: string;
  correlationId: string;
}): Promise<EmitBrainEventResult> {
  if (!isSupabaseConfigured()) {
    return { ok: true, skipped: true, reason: "Supabase not configured" };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: true, skipped: true, reason: "No authenticated user" };
  }

  const { data: membership } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.tenant_id) {
    return { ok: true, skipped: true, reason: "No workspace (tenant)" };
  }

  const payload = {
    provisioningId: input.provisioningId,
    accessCodeId: input.accessCodeId,
  };

  const { data, error } = await supabase
    .from("brain_events")
    .insert({
      event_type: BrainEventTypes.CONSIGNMENT_AGENT_ACCESS_CODE_ISSUED,
      module: "consignment",
      tenant_id: membership.tenant_id as string,
      branch_id: input.principalBranchId,
      actor_id: user.id,
      actor_type: "user",
      entity_type: "consignment_agent_access_code",
      entity_id: input.accessCodeId,
      occurred_at: new Date().toISOString(),
      severity: "notice" as BrainEventSeverity,
      correlation_id: input.correlationId,
      payload,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, id: data.id as string };
}

export async function emitConsignmentAgentAccessCodeRedeemedBrainEvent(input: {
  provisioningId: string;
  accessCodeId: string;
  principalBranchId: string;
  agentUserId: string;
  correlationId: string;
}): Promise<EmitBrainEventResult> {
  if (!isSupabaseConfigured()) {
    return { ok: true, skipped: true, reason: "Supabase not configured" };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: true, skipped: true, reason: "No authenticated user" };
  }

  const { data: membership } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.tenant_id) {
    return { ok: true, skipped: true, reason: "No workspace (tenant)" };
  }

  const payload = {
    provisioningId: input.provisioningId,
    accessCodeId: input.accessCodeId,
    agentUserId: input.agentUserId,
  };

  const { data, error } = await supabase
    .from("brain_events")
    .insert({
      event_type: BrainEventTypes.CONSIGNMENT_AGENT_ACCESS_CODE_REDEEMED,
      module: "consignment",
      tenant_id: membership.tenant_id as string,
      branch_id: input.principalBranchId,
      actor_id: user.id,
      actor_type: "user",
      entity_type: "consignment_agent_access_code",
      entity_id: input.accessCodeId,
      occurred_at: new Date().toISOString(),
      severity: "info" as BrainEventSeverity,
      correlation_id: input.correlationId,
      payload,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, id: data.id as string };
}

export async function emitCashPlanReserveCreatedBrainEvent(input: {
  reserveId: string;
  name: string;
  purpose: string;
  targetAmount: number | null;
  dueDate: string | null;
  priority: string;
  branchId: string;
  correlationId: string;
}): Promise<EmitBrainEventResult> {
  if (!isSupabaseConfigured()) {
    return { ok: true, skipped: true, reason: "Supabase not configured" };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: true, skipped: true, reason: "No authenticated user" };
  }

  const { data: membership } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.tenant_id) {
    return { ok: true, skipped: true, reason: "No workspace (tenant)" };
  }

  const payload = {
    reserveId: input.reserveId,
    name: input.name,
    purpose: input.purpose,
    targetAmount: input.targetAmount,
    dueDate: input.dueDate,
    priority: input.priority,
    branchId: input.branchId,
  };

  const { data, error } = await supabase
    .from("brain_events")
    .insert({
      event_type: BrainEventTypes.CASHPLAN_RESERVE_CREATED,
      module: "cashplan",
      tenant_id: membership.tenant_id as string,
      branch_id: input.branchId,
      actor_id: user.id,
      actor_type: "user",
      entity_type: "cashplan_reserve",
      entity_id: input.reserveId,
      occurred_at: new Date().toISOString(),
      severity: "notice" as BrainEventSeverity,
      correlation_id: input.correlationId,
      payload,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, id: data.id as string };
}

export async function emitCashPlanReserveFundedBrainEvent(input: {
  reserveId: string;
  reserveName: string;
  amount: number;
  branchId: string;
  correlationId: string;
}): Promise<EmitBrainEventResult> {
  if (!isSupabaseConfigured()) {
    return { ok: true, skipped: true, reason: "Supabase not configured" };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: true, skipped: true, reason: "No authenticated user" };
  }

  const { data: membership } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.tenant_id) {
    return { ok: true, skipped: true, reason: "No workspace (tenant)" };
  }

  const payload = {
    reserveId: input.reserveId,
    reserveName: input.reserveName,
    amount: input.amount,
    branchId: input.branchId,
  };

  const { data, error } = await supabase
    .from("brain_events")
    .insert({
      event_type: BrainEventTypes.CASHPLAN_RESERVE_FUNDED,
      module: "cashplan",
      tenant_id: membership.tenant_id as string,
      branch_id: input.branchId,
      actor_id: user.id,
      actor_type: "user",
      entity_type: "cashplan_reserve",
      entity_id: input.reserveId,
      occurred_at: new Date().toISOString(),
      severity: "info" as BrainEventSeverity,
      correlation_id: input.correlationId,
      payload,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, id: data.id as string };
}

export async function emitCashPlanReserveApprovalRequestedBrainEvent(input: {
  requestId: string;
  approvalKind: string;
  reserveId: string;
  reserveName: string;
  branchId: string;
  amount?: number;
  correlationId: string;
}): Promise<EmitBrainEventResult> {
  if (!isSupabaseConfigured()) {
    return { ok: true, skipped: true, reason: "Supabase not configured" };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: true, skipped: true, reason: "No authenticated user" };
  }

  const { data: membership } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.tenant_id) {
    return { ok: true, skipped: true, reason: "No workspace (tenant)" };
  }

  const payload = {
    requestId: input.requestId,
    approvalKind: input.approvalKind,
    reserveId: input.reserveId,
    reserveName: input.reserveName,
    amount: input.amount,
    branchId: input.branchId,
  };

  const { data, error } = await supabase
    .from("brain_events")
    .insert({
      event_type: BrainEventTypes.CASHPLAN_RESERVE_APPROVAL_REQUESTED,
      module: "cashplan",
      tenant_id: membership.tenant_id as string,
      branch_id: input.branchId,
      actor_id: user.id,
      actor_type: "user",
      entity_type: "cashplan_reserve_approval",
      entity_id: input.requestId,
      occurred_at: new Date().toISOString(),
      severity: "warning" as BrainEventSeverity,
      correlation_id: input.correlationId,
      payload,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, id: data.id as string };
}

export async function emitCashPlanReserveApprovalResolvedBrainEvent(input: {
  requestId: string;
  approvalKind: string;
  reserveId: string;
  reserveName: string;
  resolution: "approved" | "rejected";
  branchId: string;
  correlationId: string;
  amount?: number;
}): Promise<EmitBrainEventResult> {
  if (!isSupabaseConfigured()) {
    return { ok: true, skipped: true, reason: "Supabase not configured" };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: true, skipped: true, reason: "No authenticated user" };
  }

  const { data: membership } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership?.tenant_id) {
    return { ok: true, skipped: true, reason: "No workspace (tenant)" };
  }

  const payload = {
    requestId: input.requestId,
    approvalKind: input.approvalKind,
    reserveId: input.reserveId,
    reserveName: input.reserveName,
    resolution: input.resolution,
    amount: input.amount,
    branchId: input.branchId,
  };

  const { data, error } = await supabase
    .from("brain_events")
    .insert({
      event_type: BrainEventTypes.CASHPLAN_RESERVE_APPROVAL_RESOLVED,
      module: "cashplan",
      tenant_id: membership.tenant_id as string,
      branch_id: input.branchId,
      actor_id: user.id,
      actor_type: "user",
      entity_type: "cashplan_reserve_approval",
      entity_id: input.requestId,
      occurred_at: new Date().toISOString(),
      severity: (input.resolution === "approved" ? "notice" : "info") as BrainEventSeverity,
      correlation_id: input.correlationId,
      payload,
    })
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, id: data.id as string };
}

export async function listBrainEvents(filters: ListBrainEventsInput = {}): Promise<ListBrainEventsResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase is not configured." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sign in to view Brain events." };
  }

  const limit = Math.min(Math.max(filters.limit ?? 150, 1), 500);
  let q = supabase.from("brain_events").select("*").order("occurred_at", { ascending: false }).limit(limit);

  if (filters.module?.trim()) q = q.eq("module", filters.module.trim());
  if (filters.eventType?.trim()) q = q.eq("event_type", filters.eventType.trim());
  if (filters.tenantId?.trim()) q = q.eq("tenant_id", filters.tenantId.trim());
  if (filters.from?.trim()) q = q.gte("occurred_at", filters.from.trim());
  if (filters.to?.trim()) q = q.lte("occurred_at", filters.to.trim());

  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  return { ok: true, events: (data ?? []) as BrainEventRow[] };
}
