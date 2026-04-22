"use server";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";
import { createNotification } from "@/modules/desk/services/notification-service";
import { createApprovalRequestFromSensitiveAction } from "@/modules/governance-approvals/approval-request.service";
import { computeConsignmentCustodyStockPosition } from "./stock-position";
import type { ConsignmentAgreementRow, ConsignmentMovementRow, ConsignmentSettlementRow } from "./types";
import { CONSIGNMENT_RISK_RULES, type ConsignmentRiskRuleOutput } from "./consignment-bi-risk.rules";

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function nowIso() {
  return new Date().toISOString();
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function requireCtx() {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  return { ok: true as const, ws, user, supabase };
}

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

async function insertRiskFlag(ctx: Awaited<ReturnType<typeof requireCtx>>, input: {
  agreement: ConsignmentAgreementRow;
  consignmentId?: string | null;
  flag: ConsignmentRiskRuleOutput;
  dedupeKey: string;
}): Promise<Result<{ id: string; created: boolean }>> {
  // Dedupe: if an open flag exists with same code+dedupeKey, do not create a new one.
  const { data: existing, error: e0 } = await ctx.supabase
    .from("consignment_risk_flags")
    .select("*")
    .eq("tenant_id", ctx.ws.tenant.id)
    .eq("flag_code", input.flag.flagCode)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(50);
  if (e0) return { ok: false, error: e0.message };
  const exists = (existing ?? []).some((r: any) => String((r.evidence_json as any)?.dedupe_key ?? "") === input.dedupeKey);
  if (exists) return { ok: true, value: { id: "deduped", created: false } };

  const { data, error } = await ctx.supabase
    .from("consignment_risk_flags")
    .insert({
      tenant_id: ctx.ws.tenant.id,
      agreement_id: input.agreement.id,
      consignment_id: input.consignmentId ?? null,
      agent_id: input.agreement.agentId,
      stall_branch_id: input.agreement.stallBranchId,
      flag_code: input.flag.flagCode,
      severity: input.flag.severity,
      status: "open",
      title: input.flag.title,
      summary: input.flag.summary,
      evidence_json: { ...input.flag.evidence, dedupe_key: input.dedupeKey, rule_code: input.flag.ruleCode, decision: input.flag.decision },
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: { id: String(data.id), created: true } };
}

function toDeskSeverity(sev: string): "warning" | "urgent" | "critical" {
  if (sev === "critical") return "critical";
  if (sev === "high") return "urgent";
  return "warning";
}

async function createApprovalIfNeeded(ctx: Awaited<ReturnType<typeof requireCtx>>, input: {
  agreement: ConsignmentAgreementRow;
  flag: ConsignmentRiskRuleOutput;
  riskFlagId: string;
}) {
  if (!input.flag.approvalPolicyCode) return;
  const permissionKey = input.flag.permissionKey ?? "consignment.risk.review";
  await createApprovalRequestFromSensitiveAction({
    approvalPolicyCode: input.flag.approvalPolicyCode,
    permissionKey,
    actionCode: input.flag.ruleCode,
    moduleCode: "consignment",
    entityType: "consignment_risk_flag",
    entityId: input.riskFlagId,
    branchId: input.agreement.stallBranchId ?? null,
    reason: input.flag.summary,
    payloadJson: { agreementId: input.agreement.id, agentId: input.agreement.agentId, evidence: input.flag.evidence, tasks: input.flag.actionTasks ?? [] },
  });
}

function buildCustodyOnHandMap(movements: ConsignmentMovementRow[], consignmentId: string): Map<string, number> {
  const pos = computeConsignmentCustodyStockPosition({
    consignmentId,
    movements: movements.map((m) => ({
      movementType: m.movementType,
      qtyDelta: m.qtyDelta,
      unitCost: m.unitCost,
      amountValue: m.amountValue,
      metadata: m.metadata,
      at: m.at,
    })),
  });
  const map = new Map<string, number>();
  for (const l of pos.lines) map.set(l.productId, l.onHandQty);
  return map;
}

async function loadSettlementPaymentsFromBrain(ctx: Awaited<ReturnType<typeof requireCtx>>, agreementId: string) {
  // Pull recent settlement.paid events and extract mismatch evidence (append-only; used for repeated under-remittance detection).
  const { data, error } = await ctx.supabase
    .from("brain_events")
    .select("occurred_at,payload")
    .eq("tenant_id", ctx.ws.tenant.id)
    .eq("event_type", "consignment.settlement.paid")
    .order("occurred_at", { ascending: true })
    .limit(300);
  if (error) return { ok: false as const, error: error.message };
  const rows = (data ?? [])
    .map((r: any) => {
      const p = (r.payload as any) ?? {};
      const pl = (p.payload as any) ?? {}; // our emitters wrap domain payload in payload.payload
      const settlementId = String(pl.settlement_id ?? p.settlement_id ?? "");
      const expected = Number(pl.expected_due_to_principal ?? 0);
      const remitted = Number(pl.remitted_amount ?? 0);
      const mismatch = (pl.mismatch as any) ?? null;
      return { settlementId, at: String(r.occurred_at), expectedDueToPrincipal: expected, remittedAmount: remitted, mismatch };
    })
    .filter((x) => x.settlementId.length > 0);
  return { ok: true as const, rows };
}

export async function runConsignmentRiskEvaluation(input: { agreementId: string; windowDays?: number }): Promise<
  Result<{
    generatedFlags: Array<{ id: string; flagCode: string; title: string; severity: string; decision: string }>;
    dedupedCount: number;
  }>
> {
  const ctx = await requireCtx();
  if (!ctx.ok) return ctx;
  const windowDays = Math.max(7, Math.floor(input.windowDays ?? 45));
  const fromIso = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: agRaw, error: aErr } = await ctx.supabase
    .from("consignment_agreements")
    .select("*")
    .eq("tenant_id", ctx.ws.tenant.id)
    .eq("id", input.agreementId)
    .single();
  if (aErr) return { ok: false, error: aErr.message };
  const agreement = mapAgreement(agRaw);

  const { data: consignments, error: cErr } = await ctx.supabase
    .from("consignments")
    .select("id")
    .eq("tenant_id", ctx.ws.tenant.id)
    .eq("agreement_id", agreement.id);
  if (cErr) return { ok: false, error: cErr.message };
  const consignmentIds = (consignments ?? []).map((r: any) => String(r.id));

  const { data: mvRaw, error: mErr } = await ctx.supabase
    .from("consignment_movements")
    .select("*")
    .eq("tenant_id", ctx.ws.tenant.id)
    .in("consignment_id", consignmentIds.length ? consignmentIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("movement_status", "posted")
    .gte("at", fromIso)
    .order("at", { ascending: true });
  if (mErr) return { ok: false, error: mErr.message };
  const movements = (mvRaw ?? []).map(mapMovement);

  const { data: stRaw, error: sErr } = await ctx.supabase
    .from("consignment_settlements")
    .select("*")
    .eq("tenant_id", ctx.ws.tenant.id)
    .eq("agreement_id", agreement.id)
    .order("period_to", { ascending: true })
    .limit(200);
  if (sErr) return { ok: false, error: sErr.message };
  const settlements = (stRaw ?? []).map(mapSettlement);

  // Agent trust (best-effort): latest monthly score if present.
  const { data: scoreRaw } = await ctx.supabase
    .from("consignment_agent_scores")
    .select("*")
    .eq("tenant_id", ctx.ws.tenant.id)
    .eq("agent_id", agreement.agentId)
    .order("score_period", { ascending: false })
    .limit(1);
  const latestScore = (scoreRaw ?? [])[0] as any;
  const agentTrust =
    latestScore
      ? {
          reliabilityScore: latestScore.reliability_score == null ? null : Number(latestScore.reliability_score),
          settlementDisciplineScore: latestScore.settlement_discipline_score == null ? null : Number(latestScore.settlement_discipline_score),
          scorePeriod: latestScore.score_period == null ? null : String(latestScore.score_period),
        }
      : null;

  const brainPays = await loadSettlementPaymentsFromBrain(ctx, agreement.id);
  if (!brainPays.ok) return { ok: false, error: brainPays.error };

  // Custody position: compute per consignment then merge (we need it for expired agreement + stock active).
  const custodyOnHandByProductId = new Map<string, number>();
  for (const cid of consignmentIds) {
    const mv = movements.filter((m) => m.consignmentId === cid);
    const map = buildCustodyOnHandMap(mv, cid);
    for (const [pid, qty] of map.entries()) {
      custodyOnHandByProductId.set(pid, round2((custodyOnHandByProductId.get(pid) ?? 0) + qty));
    }
  }

  const ruleCtx = {
    nowIso: nowIso(),
    agreement,
    movements,
    settlements,
    settlementPayments: brainPays.rows,
    agentTrust,
    custodyOnHandByProductId,
  };

  const outputs: ConsignmentRiskRuleOutput[] = [
    ...CONSIGNMENT_RISK_RULES.soldBelowMinimum(ruleCtx),
    ...CONSIGNMENT_RISK_RULES.delayedSettlement(ruleCtx),
    ...CONSIGNMENT_RISK_RULES.repeatedUnderRemittance(ruleCtx),
    ...CONSIGNMENT_RISK_RULES.repeatedStockDiscrepancies(ruleCtx),
    ...CONSIGNMENT_RISK_RULES.repeatedDamageClaims(ruleCtx),
    ...CONSIGNMENT_RISK_RULES.manualAdjustment(ruleCtx),
    ...CONSIGNMENT_RISK_RULES.largeIssueToLowTrustAgent(ruleCtx),
    ...CONSIGNMENT_RISK_RULES.agreementExpiredStockActive(ruleCtx),
  ];

  const generatedFlags: Array<{ id: string; flagCode: string; title: string; severity: string; decision: string }> = [];
  let dedupedCount = 0;

  for (const o of outputs) {
    const dedupeKey = `${agreement.id}:${o.flagCode}:${JSON.stringify(o.evidence)}`.slice(0, 900);
    const ins = await insertRiskFlag(ctx, { agreement, consignmentId: null, flag: o, dedupeKey });
    if (!ins.ok) return { ok: false, error: ins.error };
    if (!ins.value.created) {
      dedupedCount += 1;
      continue;
    }

    generatedFlags.push({ id: ins.value.id, flagCode: o.flagCode, title: o.title, severity: o.severity, decision: o.decision });

    // Notifications serve as "action tasks" for desks today (until a dedicated tasks module exists).
    createNotification({
      moduleKey: "consignment",
      entityType: "consignment_risk_flag",
      entityId: ins.value.id,
      branchId: agreement.stallBranchId ?? null,
      title: o.title,
      message: o.summary,
      severity: toDeskSeverity(o.severity),
      category: "exception",
      intendedRoleIds: [],
      intendedStaffIds: [],
      visibleToSysAdmin: true,
      visibleToBranchManagers: true,
      requiresAcknowledgement: o.severity === "critical" || o.decision === "block",
      linkedApprovalId: null,
      expiresAt: null,
      metadata: { flagCode: o.flagCode, ruleCode: o.ruleCode, decision: o.decision, tasks: o.actionTasks ?? [], evidence: o.evidence },
    });

    // Approval triggers (where required)
    if (o.decision === "approval_required") {
      await createApprovalIfNeeded(ctx, { agreement, flag: o, riskFlagId: ins.value.id });
    }
  }

  return { ok: true, value: { generatedFlags, dedupedCount } };
}

