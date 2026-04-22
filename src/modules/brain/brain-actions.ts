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

async function getAuthedTenantContext(): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>; userId: string; tenantId: string }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; error: string }
> {
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
  return { ok: true, supabase, userId: user.id, tenantId: membership.tenant_id as string };
}

export async function emitBrainEventForWorkspace(input: {
  eventType: string;
  module: string;
  tenantId: string;
  branchId: string | null;
  actorId: string;
  actorType: "user" | "system" | "integration";
  entityType: string;
  entityId: string;
  occurredAt: string;
  severity: BrainEventSeverity;
  correlationId: string;
  payload: Record<string, unknown>;
}): Promise<EmitBrainEventResult> {
  const ctx = await getAuthedTenantContext();
  if (!ctx.ok) return ctx;
  if ("skipped" in ctx) return ctx;

  // Defensive: enforce tenant match (do not allow caller to spoof tenantId).
  if (input.tenantId !== ctx.tenantId) {
    return { ok: false, error: "Tenant mismatch for brain event emission" };
  }

  const { data, error } = await ctx.supabase
    .from("brain_events")
    .insert({
      event_type: input.eventType,
      module: input.module,
      tenant_id: input.tenantId,
      branch_id: input.branchId,
      actor_id: input.actorId,
      actor_type: input.actorType,
      entity_type: input.entityType,
      entity_id: input.entityId,
      occurred_at: input.occurredAt,
      severity: input.severity,
      correlation_id: input.correlationId,
      payload: input.payload,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id as string };
}

/**
 * Record a completed POS sale — primary vertical slice for Brain memory.
 */
export async function emitPosSaleCompletedBrainEvent(input: {
  sale: Sale;
  correlationId: string;
  /** Optional metadata (e.g. terminalSessionId) merged into payload; same event type `pos.sale.completed`. */
  payloadExtras?: Record<string, unknown>;
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
    ...(s.surface ? { surface: s.surface } : {}),
    ...(s.terminalProfileId ? { terminalProfileId: s.terminalProfileId } : {}),
    ...(input.payloadExtras ?? {}),
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

export async function emitPosSaleVoidedBrainEvent(input: {
  sale: Sale;
  correlationId: string;
  reason: string;
  /** Optional metadata merged into payload. */
  payloadExtras?: Record<string, unknown>;
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
    voidedAt: s.voidedAt ?? null,
    voidedReason: input.reason.slice(0, 280),
    lineCount: s.lines.length,
    payments: s.payments.map((p) => ({ method: p.method, amount: p.amount })),
    ...(s.surface ? { surface: s.surface } : {}),
    ...(s.terminalProfileId ? { terminalProfileId: s.terminalProfileId } : {}),
    ...(input.payloadExtras ?? {}),
  };

  const occurredAt = s.voidedAt ?? new Date().toISOString();

  const { data, error } = await supabase
    .from("brain_events")
    .insert({
      event_type: BrainEventTypes.POS_SALE_VOIDED,
      module: "pos",
      tenant_id: membership.tenant_id as string,
      branch_id: s.branchId,
      actor_id: user.id,
      actor_type: "user",
      entity_type: "sale",
      entity_id: s.id,
      occurred_at: occurredAt,
      severity: "warning",
      correlation_id: input.correlationId,
      payload,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id as string };
}

export async function emitPosReceiptReprintedBrainEvent(input: {
  sale: Sale;
  correlationId: string;
  reason: string;
  /** Optional metadata merged into payload. */
  payloadExtras?: Record<string, unknown>;
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
    reprintReason: input.reason.slice(0, 280),
    ...(s.surface ? { surface: s.surface } : {}),
    ...(s.terminalProfileId ? { terminalProfileId: s.terminalProfileId } : {}),
    ...(input.payloadExtras ?? {}),
  };

  const occurredAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("brain_events")
    .insert({
      event_type: BrainEventTypes.POS_RECEIPT_REPRINTED,
      module: "pos",
      tenant_id: membership.tenant_id as string,
      branch_id: s.branchId,
      actor_id: user.id,
      actor_type: "user",
      entity_type: "receipt",
      entity_id: s.receiptNumber,
      occurred_at: occurredAt,
      severity: "notice",
      correlation_id: input.correlationId,
      payload,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id as string };
}

export async function emitPosSaleReturnedBrainEvent(input: {
  sale: Sale;
  returnId: string;
  correlationId: string;
  reason: string;
  /** Optional metadata merged into payload. */
  payloadExtras?: Record<string, unknown>;
  returnPayload: {
    subtotal: number;
    salesTaxAmount?: number;
    taxableNetBase?: number;
    lineCount: number;
    lines: Array<{ productId: string; sku: string; name: string; qty: number; lineTotal: number }>;
  };
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
    returnId: input.returnId,
    branchId: s.branchId,
    status: s.status,
    returnReason: input.reason.slice(0, 280),
    return: input.returnPayload,
    ...(s.surface ? { surface: s.surface } : {}),
    ...(s.terminalProfileId ? { terminalProfileId: s.terminalProfileId } : {}),
    ...(input.payloadExtras ?? {}),
  };

  const occurredAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("brain_events")
    .insert({
      event_type: BrainEventTypes.POS_SALE_RETURNED,
      module: "pos",
      tenant_id: membership.tenant_id as string,
      branch_id: s.branchId,
      actor_id: user.id,
      actor_type: "user",
      entity_type: "sale",
      entity_id: s.id,
      occurred_at: occurredAt,
      severity: "warning",
      correlation_id: input.correlationId,
      payload,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id as string };
}

export async function emitTerminalShiftOpenedBrainEvent(input: {
  tenantId: string;
  branchId: string;
  terminalProfileId: string;
  shiftId: string;
  correlationId: string;
  openingFloat: number;
  occurredAt: string;
  payloadExtras?: Record<string, unknown>;
}): Promise<EmitBrainEventResult> {
  return emitBrainEventForWorkspace({
    eventType: BrainEventTypes.TERMINAL_SHIFT_OPENED,
    module: "terminal",
    tenantId: input.tenantId,
    branchId: input.branchId,
    actorId: input.payloadExtras?.actorId ? String(input.payloadExtras.actorId) : "terminal_local",
    actorType: "system",
    entityType: "terminal_shift",
    entityId: input.shiftId,
    occurredAt: input.occurredAt,
    severity: "notice",
    correlationId: input.correlationId,
    payload: {
      terminalProfileId: input.terminalProfileId,
      openingFloat: input.openingFloat,
      ...(input.payloadExtras ?? {}),
    },
  });
}

export async function emitTerminalShiftClosedBrainEvent(input: {
  tenantId: string;
  branchId: string;
  terminalProfileId: string;
  shiftId: string;
  correlationId: string;
  closingCount: number;
  expectedCashAtClose: number | null;
  cashVariance: number | null;
  varianceReason: string | null;
  occurredAt: string;
  payloadExtras?: Record<string, unknown>;
}): Promise<EmitBrainEventResult> {
  return emitBrainEventForWorkspace({
    eventType: BrainEventTypes.TERMINAL_SHIFT_CLOSED,
    module: "terminal",
    tenantId: input.tenantId,
    branchId: input.branchId,
    actorId: input.payloadExtras?.actorId ? String(input.payloadExtras.actorId) : "terminal_local",
    actorType: "system",
    entityType: "terminal_shift",
    entityId: input.shiftId,
    occurredAt: input.occurredAt,
    severity: "warning",
    correlationId: input.correlationId,
    payload: {
      terminalProfileId: input.terminalProfileId,
      closingCount: input.closingCount,
      expectedCashAtClose: input.expectedCashAtClose,
      cashVariance: input.cashVariance,
      varianceReason: input.varianceReason,
      ...(input.payloadExtras ?? {}),
    },
  });
}

export async function emitTerminalCashMovementRecordedBrainEvent(input: {
  tenantId: string;
  branchId: string;
  terminalProfileId: string;
  shiftId: string;
  movementId: string;
  kind: "cash_in" | "cash_out" | "paid_out";
  amount: number;
  memo: string;
  correlationId: string;
  occurredAt: string;
  payloadExtras?: Record<string, unknown>;
}): Promise<EmitBrainEventResult> {
  return emitBrainEventForWorkspace({
    eventType: BrainEventTypes.TERMINAL_CASH_MOVEMENT_RECORDED,
    module: "terminal",
    tenantId: input.tenantId,
    branchId: input.branchId,
    actorId: input.payloadExtras?.actorId ? String(input.payloadExtras.actorId) : "terminal_local",
    actorType: "system",
    entityType: "terminal_cash_movement",
    entityId: input.movementId,
    occurredAt: input.occurredAt,
    severity: "notice",
    correlationId: input.correlationId,
    payload: {
      terminalProfileId: input.terminalProfileId,
      shiftId: input.shiftId,
      kind: input.kind,
      amount: input.amount,
      memo: input.memo,
      ...(input.payloadExtras ?? {}),
    },
  });
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

// -------------------------------------------------------------------------------------------------
// Consignment BI emitters (append-only, auditable, rules/scoring attach later)
// -------------------------------------------------------------------------------------------------

type ConsignmentBiEmitBase = {
  principalVendorId?: string;
  agentId: string;
  consignmentId: string;
  productId?: string | null;
  quantity?: number | null;
  value?: number | null;
  occurredAt: string;
  correlationId: string;
  payload?: Record<string, unknown>;
  principalBranchId?: string | null;
  stallBranchId?: string | null;
};

function consignmentBiBasePayload(input: {
  tenantId: string;
  principalVendorId: string;
  agentId: string;
  consignmentId: string;
  productId: string | null;
  quantity: number | null;
  value: number | null;
  occurredAt: string;
  correlationId: string;
  payload: Record<string, unknown>;
}) {
  return {
    tenant_id: input.tenantId,
    principal_vendor_id: input.principalVendorId,
    agent_id: input.agentId,
    consignment_id: input.consignmentId,
    product_id: input.productId,
    quantity: input.quantity,
    value: input.value,
    occurred_at: input.occurredAt,
    correlation_id: input.correlationId,
    payload: input.payload,
  };
}

export async function emitConsignmentStockIssuedBrainEvent(input: ConsignmentBiEmitBase & { issueInvoiceId?: string | null }) {
  const ctx = await getAuthedTenantContext();
  if (!ctx.ok) return ctx;
  if ("skipped" in ctx) return ctx;
  const tenantId = ctx.tenantId;
  const principalVendorId = input.principalVendorId ?? tenantId;
  const payload = consignmentBiBasePayload({
    tenantId,
    principalVendorId,
    agentId: input.agentId,
    consignmentId: input.consignmentId,
    productId: input.productId ?? null,
    quantity: input.quantity ?? null,
    value: input.value ?? null,
    occurredAt: input.occurredAt,
    correlationId: input.correlationId,
    payload: {
      ...(input.payload ?? {}),
      from_branch_id: input.principalBranchId ?? null,
      to_stall_branch_id: input.stallBranchId ?? null,
      issue_invoice_id: input.issueInvoiceId ?? null,
    },
  });
  return emitBrainEventForWorkspace({
    eventType: BrainEventTypes.CONSIGNMENT_STOCK_ISSUED,
    module: "consignment",
    tenantId,
    branchId: input.principalBranchId ?? null,
    actorId: ctx.userId,
    actorType: "user",
    entityType: "consignment_stock_movement",
    entityId: input.consignmentId,
    occurredAt: input.occurredAt,
    severity: "notice",
    correlationId: input.correlationId,
    payload: { event: BrainEventTypes.CONSIGNMENT_STOCK_ISSUED, ...payload },
  });
}

export async function emitConsignmentStockReceivedBrainEvent(input: ConsignmentBiEmitBase) {
  const ctx = await getAuthedTenantContext();
  if (!ctx.ok) return ctx;
  if ("skipped" in ctx) return ctx;
  const tenantId = ctx.tenantId;
  const principalVendorId = input.principalVendorId ?? tenantId;
  const payload = consignmentBiBasePayload({
    tenantId,
    principalVendorId,
    agentId: input.agentId,
    consignmentId: input.consignmentId,
    productId: input.productId ?? null,
    quantity: input.quantity ?? null,
    value: input.value ?? null,
    occurredAt: input.occurredAt,
    correlationId: input.correlationId,
    payload: input.payload ?? {},
  });
  return emitBrainEventForWorkspace({
    eventType: BrainEventTypes.CONSIGNMENT_STOCK_RECEIVED,
    module: "consignment",
    tenantId,
    branchId: input.principalBranchId ?? null,
    actorId: ctx.userId,
    actorType: "user",
    entityType: "consignment_stock_movement",
    entityId: input.consignmentId,
    occurredAt: input.occurredAt,
    severity: "info",
    correlationId: input.correlationId,
    payload: { event: BrainEventTypes.CONSIGNMENT_STOCK_RECEIVED, ...payload },
  });
}

export async function emitConsignmentStockSoldBrainEvent(
  input: ConsignmentBiEmitBase & { saleId?: string | null; receiptNumber?: string | null; unitCost?: number | null; unitPrice?: number | null },
) {
  const ctx = await getAuthedTenantContext();
  if (!ctx.ok) return ctx;
  if ("skipped" in ctx) return ctx;
  const tenantId = ctx.tenantId;
  const principalVendorId = input.principalVendorId ?? tenantId;
  const payload = consignmentBiBasePayload({
    tenantId,
    principalVendorId,
    agentId: input.agentId,
    consignmentId: input.consignmentId,
    productId: input.productId ?? null,
    quantity: input.quantity ?? null,
    value: input.value ?? null,
    occurredAt: input.occurredAt,
    correlationId: input.correlationId,
    payload: {
      ...(input.payload ?? {}),
      sale_id: input.saleId ?? null,
      receipt_number: input.receiptNumber ?? null,
      stall_branch_id: input.stallBranchId ?? null,
      unit_cost: input.unitCost ?? null,
      unit_price: input.unitPrice ?? null,
    },
  });
  return emitBrainEventForWorkspace({
    eventType: BrainEventTypes.CONSIGNMENT_STOCK_SOLD,
    module: "consignment",
    tenantId,
    branchId: input.stallBranchId ?? null,
    actorId: ctx.userId,
    actorType: "user",
    entityType: "consignment_sale",
    entityId: input.saleId ?? input.consignmentId,
    occurredAt: input.occurredAt,
    severity: "info",
    correlationId: input.correlationId,
    payload: { event: BrainEventTypes.CONSIGNMENT_STOCK_SOLD, ...payload },
  });
}

export async function emitConsignmentStockReturnedBrainEvent(input: ConsignmentBiEmitBase) {
  const ctx = await getAuthedTenantContext();
  if (!ctx.ok) return ctx;
  if ("skipped" in ctx) return ctx;
  const tenantId = ctx.tenantId;
  const principalVendorId = input.principalVendorId ?? tenantId;
  const payload = consignmentBiBasePayload({
    tenantId,
    principalVendorId,
    agentId: input.agentId,
    consignmentId: input.consignmentId,
    productId: input.productId ?? null,
    quantity: input.quantity ?? null,
    value: input.value ?? null,
    occurredAt: input.occurredAt,
    correlationId: input.correlationId,
    payload: input.payload ?? {},
  });
  return emitBrainEventForWorkspace({
    eventType: BrainEventTypes.CONSIGNMENT_STOCK_RETURNED,
    module: "consignment",
    tenantId,
    branchId: input.principalBranchId ?? null,
    actorId: ctx.userId,
    actorType: "user",
    entityType: "consignment_stock_movement",
    entityId: input.consignmentId,
    occurredAt: input.occurredAt,
    severity: "notice",
    correlationId: input.correlationId,
    payload: { event: BrainEventTypes.CONSIGNMENT_STOCK_RETURNED, ...payload },
  });
}

export async function emitConsignmentStockDamagedBrainEvent(input: ConsignmentBiEmitBase) {
  const ctx = await getAuthedTenantContext();
  if (!ctx.ok) return ctx;
  if ("skipped" in ctx) return ctx;
  const tenantId = ctx.tenantId;
  const principalVendorId = input.principalVendorId ?? tenantId;
  const payload = consignmentBiBasePayload({
    tenantId,
    principalVendorId,
    agentId: input.agentId,
    consignmentId: input.consignmentId,
    productId: input.productId ?? null,
    quantity: input.quantity ?? null,
    value: input.value ?? null,
    occurredAt: input.occurredAt,
    correlationId: input.correlationId,
    payload: input.payload ?? {},
  });
  return emitBrainEventForWorkspace({
    eventType: BrainEventTypes.CONSIGNMENT_STOCK_DAMAGED,
    module: "consignment",
    tenantId,
    branchId: input.stallBranchId ?? null,
    actorId: ctx.userId,
    actorType: "user",
    entityType: "consignment_stock_movement",
    entityId: input.consignmentId,
    occurredAt: input.occurredAt,
    severity: "warning",
    correlationId: input.correlationId,
    payload: { event: BrainEventTypes.CONSIGNMENT_STOCK_DAMAGED, ...payload },
  });
}

export async function emitConsignmentStockMissingBrainEvent(input: ConsignmentBiEmitBase) {
  const ctx = await getAuthedTenantContext();
  if (!ctx.ok) return ctx;
  if ("skipped" in ctx) return ctx;
  const tenantId = ctx.tenantId;
  const principalVendorId = input.principalVendorId ?? tenantId;
  const payload = consignmentBiBasePayload({
    tenantId,
    principalVendorId,
    agentId: input.agentId,
    consignmentId: input.consignmentId,
    productId: input.productId ?? null,
    quantity: input.quantity ?? null,
    value: input.value ?? null,
    occurredAt: input.occurredAt,
    correlationId: input.correlationId,
    payload: input.payload ?? {},
  });
  return emitBrainEventForWorkspace({
    eventType: BrainEventTypes.CONSIGNMENT_STOCK_MISSING,
    module: "consignment",
    tenantId,
    branchId: input.stallBranchId ?? null,
    actorId: ctx.userId,
    actorType: "user",
    entityType: "consignment_stock_movement",
    entityId: input.consignmentId,
    occurredAt: input.occurredAt,
    severity: "warning",
    correlationId: input.correlationId,
    payload: { event: BrainEventTypes.CONSIGNMENT_STOCK_MISSING, ...payload },
  });
}

export async function emitConsignmentSettlementCreatedBrainEvent(input: ConsignmentBiEmitBase & { settlementId: string }) {
  const ctx = await getAuthedTenantContext();
  if (!ctx.ok) return ctx;
  if ("skipped" in ctx) return ctx;
  const tenantId = ctx.tenantId;
  const principalVendorId = input.principalVendorId ?? tenantId;
  const payload = consignmentBiBasePayload({
    tenantId,
    principalVendorId,
    agentId: input.agentId,
    consignmentId: input.consignmentId,
    productId: input.productId ?? null,
    quantity: input.quantity ?? null,
    value: input.value ?? null,
    occurredAt: input.occurredAt,
    correlationId: input.correlationId,
    payload: { ...(input.payload ?? {}), settlement_id: input.settlementId },
  });
  return emitBrainEventForWorkspace({
    eventType: BrainEventTypes.CONSIGNMENT_SETTLEMENT_CREATED,
    module: "consignment",
    tenantId,
    branchId: input.principalBranchId ?? null,
    actorId: ctx.userId,
    actorType: "user",
    entityType: "consignment_settlement",
    entityId: input.settlementId,
    occurredAt: input.occurredAt,
    severity: "notice",
    correlationId: input.correlationId,
    payload: { event: BrainEventTypes.CONSIGNMENT_SETTLEMENT_CREATED, ...payload },
  });
}

export async function emitConsignmentSettlementPaidBrainEvent(input: ConsignmentBiEmitBase & { settlementId: string }) {
  const ctx = await getAuthedTenantContext();
  if (!ctx.ok) return ctx;
  if ("skipped" in ctx) return ctx;
  const tenantId = ctx.tenantId;
  const principalVendorId = input.principalVendorId ?? tenantId;
  const payload = consignmentBiBasePayload({
    tenantId,
    principalVendorId,
    agentId: input.agentId,
    consignmentId: input.consignmentId,
    productId: input.productId ?? null,
    quantity: input.quantity ?? null,
    value: input.value ?? null,
    occurredAt: input.occurredAt,
    correlationId: input.correlationId,
    payload: { ...(input.payload ?? {}), settlement_id: input.settlementId },
  });
  return emitBrainEventForWorkspace({
    eventType: BrainEventTypes.CONSIGNMENT_SETTLEMENT_PAID,
    module: "consignment",
    tenantId,
    branchId: input.principalBranchId ?? null,
    actorId: ctx.userId,
    actorType: "user",
    entityType: "consignment_settlement",
    entityId: input.settlementId,
    occurredAt: input.occurredAt,
    severity: "notice",
    correlationId: input.correlationId,
    payload: { event: BrainEventTypes.CONSIGNMENT_SETTLEMENT_PAID, ...payload },
  });
}

export async function emitConsignmentSettlementOverdueBrainEvent(input: ConsignmentBiEmitBase & { settlementId: string; daysOverdue?: number | null }) {
  const ctx = await getAuthedTenantContext();
  if (!ctx.ok) return ctx;
  if ("skipped" in ctx) return ctx;
  const tenantId = ctx.tenantId;
  const principalVendorId = input.principalVendorId ?? tenantId;
  const payload = consignmentBiBasePayload({
    tenantId,
    principalVendorId,
    agentId: input.agentId,
    consignmentId: input.consignmentId,
    productId: input.productId ?? null,
    quantity: input.quantity ?? null,
    value: input.value ?? null,
    occurredAt: input.occurredAt,
    correlationId: input.correlationId,
    payload: { ...(input.payload ?? {}), settlement_id: input.settlementId, days_overdue: input.daysOverdue ?? null },
  });
  return emitBrainEventForWorkspace({
    eventType: BrainEventTypes.CONSIGNMENT_SETTLEMENT_OVERDUE,
    module: "consignment",
    tenantId,
    branchId: input.principalBranchId ?? null,
    actorId: ctx.userId,
    actorType: "user",
    entityType: "consignment_settlement",
    entityId: input.settlementId,
    occurredAt: input.occurredAt,
    severity: "warning",
    correlationId: input.correlationId,
    payload: { event: BrainEventTypes.CONSIGNMENT_SETTLEMENT_OVERDUE, ...payload },
  });
}

export async function emitConsignmentReconciliationPerformedBrainEvent(
  input: ConsignmentBiEmitBase & { reconciliationId: string; varianceQty?: number | null; varianceValue?: number | null },
) {
  const ctx = await getAuthedTenantContext();
  if (!ctx.ok) return ctx;
  if ("skipped" in ctx) return ctx;
  const tenantId = ctx.tenantId;
  const principalVendorId = input.principalVendorId ?? tenantId;
  const payload = consignmentBiBasePayload({
    tenantId,
    principalVendorId,
    agentId: input.agentId,
    consignmentId: input.consignmentId,
    productId: input.productId ?? null,
    quantity: input.quantity ?? null,
    value: input.value ?? null,
    occurredAt: input.occurredAt,
    correlationId: input.correlationId,
    payload: {
      ...(input.payload ?? {}),
      reconciliation_id: input.reconciliationId,
      variance_qty: input.varianceQty ?? null,
      variance_value: input.varianceValue ?? null,
    },
  });
  return emitBrainEventForWorkspace({
    eventType: BrainEventTypes.CONSIGNMENT_RECONCILIATION_PERFORMED,
    module: "consignment",
    tenantId,
    branchId: input.stallBranchId ?? null,
    actorId: ctx.userId,
    actorType: "user",
    entityType: "consignment_reconciliation",
    entityId: input.reconciliationId,
    occurredAt: input.occurredAt,
    severity: "notice",
    correlationId: input.correlationId,
    payload: { event: BrainEventTypes.CONSIGNMENT_RECONCILIATION_PERFORMED, ...payload },
  });
}

export async function emitConsignmentDisputeCreatedBrainEvent(input: ConsignmentBiEmitBase & { disputeId: string; disputeKind?: string | null }) {
  const ctx = await getAuthedTenantContext();
  if (!ctx.ok) return ctx;
  if ("skipped" in ctx) return ctx;
  const tenantId = ctx.tenantId;
  const principalVendorId = input.principalVendorId ?? tenantId;
  const payload = consignmentBiBasePayload({
    tenantId,
    principalVendorId,
    agentId: input.agentId,
    consignmentId: input.consignmentId,
    productId: input.productId ?? null,
    quantity: input.quantity ?? null,
    value: input.value ?? null,
    occurredAt: input.occurredAt,
    correlationId: input.correlationId,
    payload: { ...(input.payload ?? {}), dispute_id: input.disputeId, dispute_kind: input.disputeKind ?? null },
  });
  return emitBrainEventForWorkspace({
    eventType: BrainEventTypes.CONSIGNMENT_DISPUTE_CREATED,
    module: "consignment",
    tenantId,
    branchId: input.principalBranchId ?? null,
    actorId: ctx.userId,
    actorType: "user",
    entityType: "consignment_dispute",
    entityId: input.disputeId,
    occurredAt: input.occurredAt,
    severity: "warning",
    correlationId: input.correlationId,
    payload: { event: BrainEventTypes.CONSIGNMENT_DISPUTE_CREATED, ...payload },
  });
}

export async function emitConsignmentReconciliationSubmittedBrainEvent(
  input: ConsignmentBiEmitBase & { reconciliationId: string; discrepancyCount?: number | null },
) {
  const ctx = await getAuthedTenantContext();
  if (!ctx.ok) return ctx;
  if ("skipped" in ctx) return ctx;
  const tenantId = ctx.tenantId;
  const principalVendorId = input.principalVendorId ?? tenantId;
  const payload = consignmentBiBasePayload({
    tenantId,
    principalVendorId,
    agentId: input.agentId,
    consignmentId: input.consignmentId,
    productId: input.productId ?? null,
    quantity: input.quantity ?? null,
    value: input.value ?? null,
    occurredAt: input.occurredAt,
    correlationId: input.correlationId,
    payload: {
      ...(input.payload ?? {}),
      reconciliation_id: input.reconciliationId,
      discrepancy_count: input.discrepancyCount ?? null,
    },
  });
  return emitBrainEventForWorkspace({
    eventType: BrainEventTypes.CONSIGNMENT_RECONCILIATION_SUBMITTED,
    module: "consignment",
    tenantId,
    branchId: input.stallBranchId ?? null,
    actorId: ctx.userId,
    actorType: "user",
    entityType: "consignment_reconciliation",
    entityId: input.reconciliationId,
    occurredAt: input.occurredAt,
    severity: "notice",
    correlationId: input.correlationId,
    payload: { event: BrainEventTypes.CONSIGNMENT_RECONCILIATION_SUBMITTED, ...payload },
  });
}

export async function emitConsignmentDocumentValidatedBrainEvent(
  input: ConsignmentBiEmitBase & {
    documentId: string;
    documentType: string;
    validationStatus: string;
  },
) {
  const ctx = await getAuthedTenantContext();
  if (!ctx.ok) return ctx;
  if ("skipped" in ctx) return ctx;
  const tenantId = ctx.tenantId;
  const principalVendorId = input.principalVendorId ?? tenantId;
  const payload = consignmentBiBasePayload({
    tenantId,
    principalVendorId,
    agentId: input.agentId,
    consignmentId: input.consignmentId,
    productId: input.productId ?? null,
    quantity: input.quantity ?? null,
    value: input.value ?? null,
    occurredAt: input.occurredAt,
    correlationId: input.correlationId,
    payload: {
      ...(input.payload ?? {}),
      document_id: input.documentId,
      document_type: input.documentType,
      validation_status: input.validationStatus,
    },
  });
  return emitBrainEventForWorkspace({
    eventType: BrainEventTypes.CONSIGNMENT_DOCUMENT_VALIDATED,
    module: "consignment",
    tenantId,
    branchId: input.stallBranchId ?? null,
    actorId: ctx.userId,
    actorType: "user",
    entityType: "consignment_document",
    entityId: input.documentId,
    occurredAt: input.occurredAt,
    severity: "info",
    correlationId: input.correlationId,
    payload: { event: BrainEventTypes.CONSIGNMENT_DOCUMENT_VALIDATED, ...payload },
  });
}

export async function emitConsignmentEvidenceGapBrainEvent(
  input: ConsignmentBiEmitBase & {
    gapCodes: string[];
    reconciliationId?: string | null;
    settlementId?: string | null;
  },
) {
  const ctx = await getAuthedTenantContext();
  if (!ctx.ok) return ctx;
  if ("skipped" in ctx) return ctx;
  const tenantId = ctx.tenantId;
  const principalVendorId = input.principalVendorId ?? tenantId;
  const payload = consignmentBiBasePayload({
    tenantId,
    principalVendorId,
    agentId: input.agentId,
    consignmentId: input.consignmentId,
    productId: input.productId ?? null,
    quantity: input.quantity ?? null,
    value: input.value ?? null,
    occurredAt: input.occurredAt,
    correlationId: input.correlationId,
    payload: {
      ...(input.payload ?? {}),
      gap_codes: input.gapCodes,
      reconciliation_id: input.reconciliationId ?? null,
      settlement_id: input.settlementId ?? null,
    },
  });
  return emitBrainEventForWorkspace({
    eventType: BrainEventTypes.CONSIGNMENT_EVIDENCE_GAP,
    module: "consignment",
    tenantId,
    branchId: input.stallBranchId ?? null,
    actorId: ctx.userId,
    actorType: "user",
    entityType: "consignment_evidence",
    entityId: input.reconciliationId ?? input.settlementId ?? input.consignmentId,
    occurredAt: input.occurredAt,
    severity: "warning",
    correlationId: input.correlationId,
    payload: { event: BrainEventTypes.CONSIGNMENT_EVIDENCE_GAP, ...payload },
  });
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
