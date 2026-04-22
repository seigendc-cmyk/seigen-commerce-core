import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";
import type {
  ConsignmentAgreementRow,
  ConsignmentRow,
  ConsignmentMovementRow,
  ConsignmentRiskFlagRow,
  ConsignmentAgentScoreRow,
  ConsignmentItemRow,
  ConsignmentReconciliationRow,
  ConsignmentSettlementRow,
} from "./types";

function mapAgreement(r: any): ConsignmentAgreementRow {
  return {
    id: String(r.id),
    tenantId: String(r.tenant_id),
    agreementCode: String(r.agreement_code),
    status: r.status,
    principalVendorName: String(r.principal_vendor_name ?? ""),
    agentId: String(r.agent_id),
    agentName: String(r.agent_name),
    stallBranchId: (r.stall_branch_id as string | null) ?? null,
    stallLabel: (r.stall_label as string | null) ?? null,
    commissionModel: r.commission_model,
    commissionPercent: r.commission_percent == null ? null : Number(r.commission_percent),
    commissionFixedPerUnit: r.commission_fixed_per_unit == null ? null : Number(r.commission_fixed_per_unit),
    commissionTiersJson: (r.commission_tiers_json as any[]) ?? [],
    minimumPriceRule: r.minimum_price_rule,
    minimumPrice: r.minimum_price == null ? null : Number(r.minimum_price),
    minimumMarginPercent: r.minimum_margin_percent == null ? null : Number(r.minimum_margin_percent),
    settlementCycle: r.settlement_cycle,
    settlementDayOfWeek: r.settlement_day_of_week == null ? null : Number(r.settlement_day_of_week),
    settlementDayOfMonth: r.settlement_day_of_month == null ? null : Number(r.settlement_day_of_month),
    settlementGraceDays: Number(r.settlement_grace_days ?? 0),
    effectiveFrom: String(r.effective_from),
    effectiveTo: (r.effective_to as string | null) ?? null,
    expiryDate: (r.expiry_date as string | null) ?? null,
    allowDiscounts: Boolean(r.allow_discounts),
    maxDiscountPercent: r.max_discount_percent == null ? null : Number(r.max_discount_percent),
    allowPriceOverride: Boolean(r.allow_price_override),
    allowReturns: Boolean(r.allow_returns),
    allowPartialSettlement: Boolean(r.allow_partial_settlement),
    notes: String(r.notes ?? ""),
    metadata: (r.metadata as any) ?? {},
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function mapConsignment(r: any): ConsignmentRow {
  return {
    id: String(r.id),
    tenantId: String(r.tenant_id),
    consignmentCode: String(r.consignment_code),
    agreementId: String(r.agreement_id),
    principalOwnerType: r.principal_owner_type,
    principalOwnerId: String(r.principal_owner_id ?? ""),
    custodyScopeType: r.custody_scope_type,
    custodyScopeId: String(r.custody_scope_id ?? ""),
    status: r.status,
    issuedAt: (r.issued_at as string | null) ?? null,
    receivedAt: (r.received_at as string | null) ?? null,
    closedAt: (r.closed_at as string | null) ?? null,
    totalItemsCount: Number(r.total_items_count ?? 0),
    totalCostValue: Number(r.total_cost_value ?? 0),
    totalSellableQty: Number(r.total_sellable_qty ?? 0),
    sourceDocumentId: (r.source_document_id as string | null) ?? null,
    notes: String(r.notes ?? ""),
    metadata: (r.metadata as any) ?? {},
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function mapMovement(r: any): ConsignmentMovementRow {
  return {
    id: String(r.id),
    tenantId: String(r.tenant_id),
    consignmentId: String(r.consignment_id),
    consignmentItemId: (r.consignment_item_id as string | null) ?? null,
    movementType: r.movement_type,
    movementStatus: r.movement_status,
    at: String(r.at),
    actorUserId: (r.actor_user_id as string | null) ?? null,
    actorLabel: String(r.actor_label ?? "system"),
    fromCustodyScopeType: (r.from_custody_scope_type as string | null) ?? null,
    fromCustodyScopeId: (r.from_custody_scope_id as string | null) ?? null,
    toCustodyScopeType: (r.to_custody_scope_type as string | null) ?? null,
    toCustodyScopeId: (r.to_custody_scope_id as string | null) ?? null,
    qtyDelta: Number(r.qty_delta ?? 0),
    unitCost: r.unit_cost == null ? null : Number(r.unit_cost),
    unitPrice: r.unit_price == null ? null : Number(r.unit_price),
    amountValue: r.amount_value == null ? null : Number(r.amount_value),
    currencyCode: String(r.currency_code ?? "USD"),
    referenceCode: (r.reference_code as string | null) ?? null,
    sourceDocumentId: (r.source_document_id as string | null) ?? null,
    relatedSaleId: (r.related_sale_id as string | null) ?? null,
    narration: String(r.narration ?? ""),
    metadata: (r.metadata as any) ?? {},
    createdAt: String(r.created_at),
  };
}

function mapRiskFlag(r: any): ConsignmentRiskFlagRow {
  return {
    id: String(r.id),
    tenantId: String(r.tenant_id),
    agreementId: (r.agreement_id as string | null) ?? null,
    consignmentId: (r.consignment_id as string | null) ?? null,
    agentId: (r.agent_id as string | null) ?? null,
    stallBranchId: (r.stall_branch_id as string | null) ?? null,
    flagCode: String(r.flag_code),
    severity: r.severity,
    status: r.status,
    title: String(r.title),
    summary: String(r.summary ?? ""),
    evidenceJson: (r.evidence_json as any) ?? {},
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function mapConsignmentItem(r: any): ConsignmentItemRow {
  return {
    id: String(r.id),
    tenantId: String(r.tenant_id),
    consignmentId: String(r.consignment_id),
    productId: String(r.product_id),
    sku: (r.sku as string | null) ?? null,
    productName: String(r.product_name ?? ""),
    unit: (r.unit as string | null) ?? null,
    ownerScopeType: r.owner_scope_type,
    ownerScopeId: String(r.owner_scope_id ?? ""),
    issuedQty: Number(r.issued_qty ?? 0),
    receivedQty: Number(r.received_qty ?? 0),
    sellableQty: Number(r.sellable_qty ?? 0),
    soldQty: Number(r.sold_qty ?? 0),
    returnedQty: Number(r.returned_qty ?? 0),
    damagedQty: Number(r.damaged_qty ?? 0),
    missingQty: Number(r.missing_qty ?? 0),
    unitCost: Number(r.unit_cost ?? 0),
    minUnitPrice: r.min_unit_price == null ? null : Number(r.min_unit_price),
    commissionModelSnapshot: String(r.commission_model_snapshot ?? ""),
    commissionRateSnapshot: r.commission_rate_snapshot == null ? null : Number(r.commission_rate_snapshot),
    metadata: (r.metadata as any) ?? {},
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function mapSettlement(r: any): ConsignmentSettlementRow {
  return {
    id: String(r.id),
    tenantId: String(r.tenant_id),
    agreementId: String(r.agreement_id),
    consignmentId: (r.consignment_id as string | null) ?? null,
    settlementCode: String(r.settlement_code),
    periodFrom: String(r.period_from),
    periodTo: String(r.period_to),
    status: r.status,
    grossSalesValue: Number(r.gross_sales_value ?? 0),
    commissionValue: Number(r.commission_value ?? 0),
    netDueToPrincipal: Number(r.net_due_to_principal ?? 0),
    netDueToAgent: Number(r.net_due_to_agent ?? 0),
    currencyCode: String(r.currency_code ?? "USD"),
    notes: String(r.notes ?? ""),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function mapReconciliation(r: any): ConsignmentReconciliationRow {
  return {
    id: String(r.id),
    tenantId: String(r.tenant_id),
    agreementId: String(r.agreement_id),
    consignmentId: (r.consignment_id as string | null) ?? null,
    reconciliationCode: String(r.reconciliation_code),
    asOfAt: String(r.as_of_at),
    status: r.status,
    expectedSellableQty: Number(r.expected_sellable_qty ?? 0),
    physicalCountQty: Number(r.physical_count_qty ?? 0),
    varianceQty: Number(r.variance_qty ?? 0),
    varianceValue: Number(r.variance_value ?? 0),
    settlementBalanceDue: Number(r.settlement_balance_due ?? 0),
    notes: String(r.notes ?? ""),
    metadata: (r.metadata as any) ?? {},
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function mapAgentScore(r: any): ConsignmentAgentScoreRow {
  return {
    id: String(r.id),
    tenantId: String(r.tenant_id),
    agentId: String(r.agent_id),
    agentName: String(r.agent_name ?? ""),
    stallBranchId: (r.stall_branch_id as string | null) ?? null,
    scorePeriod: String(r.score_period),
    scoreType: r.score_type,
    score: Number(r.score ?? 0),
    reliabilityScore: Number(r.reliability_score ?? 0),
    salesVelocityScore: Number(r.sales_velocity_score ?? 0),
    shrinkageRiskScore: Number(r.shrinkage_risk_score ?? 0),
    settlementDisciplineScore: Number(r.settlement_discipline_score ?? 0),
    metricsJson: (r.metrics_json as any) ?? {},
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

async function requireCtx() {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  return { ok: true as const, ws, user, supabase };
}

export async function listConsignmentAgreementsBi(limit = 200) {
  const ctx = await requireCtx();
  if (!ctx.ok) return ctx;
  const { data, error } = await ctx.supabase
    .from("consignment_agreements")
    .select("*")
    .eq("tenant_id", ctx.ws.tenant.id)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, rows: (data ?? []).map(mapAgreement) };
}

export async function listConsignmentsBi(limit = 200) {
  const ctx = await requireCtx();
  if (!ctx.ok) return ctx;
  const { data, error } = await ctx.supabase
    .from("consignments")
    .select("*")
    .eq("tenant_id", ctx.ws.tenant.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, rows: (data ?? []).map(mapConsignment) };
}

export async function listConsignmentMovementsBi(input: { consignmentId: string; limit?: number }) {
  const ctx = await requireCtx();
  if (!ctx.ok) return ctx;
  const limit = input.limit ?? 500;
  const { data, error } = await ctx.supabase
    .from("consignment_movements")
    .select("*")
    .eq("tenant_id", ctx.ws.tenant.id)
    .eq("consignment_id", input.consignmentId)
    .order("at", { ascending: false })
    .limit(limit);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, rows: (data ?? []).map(mapMovement) };
}

export async function listConsignmentRiskFlagsBi(input?: { limit?: number; agreementId?: string; status?: string }) {
  const ctx = await requireCtx();
  if (!ctx.ok) return ctx;
  const limit = input?.limit ?? 200;
  let q = ctx.supabase
    .from("consignment_risk_flags")
    .select("*")
    .eq("tenant_id", ctx.ws.tenant.id)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (input?.agreementId) q = q.eq("agreement_id", input.agreementId);
  if (input?.status) q = q.eq("status", input.status);
  const { data, error } = await q;
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, rows: (data ?? []).map(mapRiskFlag) };
}

export async function listConsignmentAgentScoresBi(input?: { scoreType?: string; limit?: number }) {
  const ctx = await requireCtx();
  if (!ctx.ok) return ctx;
  const limit = input?.limit ?? 200;
  const q = ctx.supabase
    .from("consignment_agent_scores")
    .select("*")
    .eq("tenant_id", ctx.ws.tenant.id)
    .order("score_period", { ascending: false })
    .limit(limit);
  if (input?.scoreType) q.eq("score_type", input.scoreType);
  const { data, error } = await q;
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, rows: (data ?? []).map(mapAgentScore) };
}

export async function listConsignmentItemsBi(input: { consignmentId: string }) {
  const ctx = await requireCtx();
  if (!ctx.ok) return ctx;
  const { data, error } = await ctx.supabase
    .from("consignment_items")
    .select("*")
    .eq("tenant_id", ctx.ws.tenant.id)
    .eq("consignment_id", input.consignmentId)
    .order("created_at", { ascending: true });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, rows: (data ?? []).map(mapConsignmentItem) };
}

export async function listConsignmentReconciliationsBi(input: { agreementId: string; limit?: number }) {
  const ctx = await requireCtx();
  if (!ctx.ok) return ctx;
  const limit = input.limit ?? 100;
  const { data, error } = await ctx.supabase
    .from("consignment_reconciliations")
    .select("*")
    .eq("tenant_id", ctx.ws.tenant.id)
    .eq("agreement_id", input.agreementId)
    .order("as_of_at", { ascending: false })
    .limit(limit);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, rows: (data ?? []).map(mapReconciliation) };
}

export async function getConsignmentReconciliationBi(reconciliationId: string) {
  const ctx = await requireCtx();
  if (!ctx.ok) return ctx;
  const { data, error } = await ctx.supabase
    .from("consignment_reconciliations")
    .select("*")
    .eq("tenant_id", ctx.ws.tenant.id)
    .eq("id", reconciliationId)
    .maybeSingle();
  if (error) return { ok: false as const, error: error.message };
  if (!data) return { ok: false as const, error: "Reconciliation not found." };
  return { ok: true as const, row: mapReconciliation(data) };
}

export async function listConsignmentSettlementsBi(input?: {
  agreementId?: string;
  status?: string;
  limit?: number;
}) {
  const ctx = await requireCtx();
  if (!ctx.ok) return ctx;
  const limit = input?.limit ?? 300;
  let q = ctx.supabase
    .from("consignment_settlements")
    .select("*")
    .eq("tenant_id", ctx.ws.tenant.id)
    .order("period_to", { ascending: false })
    .limit(limit);
  if (input?.agreementId) q = q.eq("agreement_id", input.agreementId);
  if (input?.status) q = q.eq("status", input.status);
  const { data, error } = await q;
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, rows: (data ?? []).map(mapSettlement) };
}

export async function listConsignmentReconciliationsAllBi(input?: { limit?: number }) {
  const ctx = await requireCtx();
  if (!ctx.ok) return ctx;
  const limit = input?.limit ?? 200;
  const { data, error } = await ctx.supabase
    .from("consignment_reconciliations")
    .select("*")
    .eq("tenant_id", ctx.ws.tenant.id)
    .order("as_of_at", { ascending: false })
    .limit(limit);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, rows: (data ?? []).map(mapReconciliation) };
}

export async function getConsignmentBi(consignmentId: string) {
  const ctx = await requireCtx();
  if (!ctx.ok) return ctx;
  const { data, error } = await ctx.supabase
    .from("consignments")
    .select("*")
    .eq("tenant_id", ctx.ws.tenant.id)
    .eq("id", consignmentId)
    .maybeSingle();
  if (error) return { ok: false as const, error: error.message };
  if (!data) return { ok: false as const, error: "Consignment not found." };
  return { ok: true as const, row: mapConsignment(data) };
}

