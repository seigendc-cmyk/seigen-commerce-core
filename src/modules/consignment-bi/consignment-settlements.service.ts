"use server";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";
import {
  emitConsignmentSettlementCreatedBrainEvent,
  emitConsignmentSettlementOverdueBrainEvent,
  emitConsignmentSettlementPaidBrainEvent,
} from "@/modules/brain/brain-actions";
import type { ConsignmentAgreementRow } from "./types";
import { attributeConsignmentSale, computeSettlementMismatchRule, settlementOverdueCheck } from "./settlement-calculations";

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

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

async function getAgreement(ctx: Awaited<ReturnType<typeof requireCtx>>, agreementId: string): Promise<Result<ConsignmentAgreementRow>> {
  const { data, error } = await ctx.supabase
    .from("consignment_agreements")
    .select("*")
    .eq("tenant_id", ctx.ws.tenant.id)
    .eq("id", agreementId)
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: mapAgreement(data) };
}

/**
 * Sale attribution service:
 * Treats posted BI `consignment_movements` of type `sell` as the canonical consignment sales facts.
 * Each `sell` movement should include:
 * - unit_price (sale)
 * - unit_cost (base/invoice)
 * - qty_delta (negative)
 * - metadata.product_id
 */
export async function attributeConsignmentSalesForPeriod(input: {
  agreementId: string;
  fromIso: string; // date or timestamp
  toIso: string; // date or timestamp
  correlationId: string;
}): Promise<Result<{ attributed: ReturnType<typeof attributeConsignmentSale>[] }>> {
  const ctx = await requireCtx();
  if (!ctx.ok) return ctx;
  const ag = await getAgreement(ctx, input.agreementId);
  if (!ag.ok) return ag;

  const { data: consignments, error: cErr } = await ctx.supabase
    .from("consignments")
    .select("id")
    .eq("tenant_id", ctx.ws.tenant.id)
    .eq("agreement_id", input.agreementId);
  if (cErr) return { ok: false, error: cErr.message };
  const consignmentIds = (consignments ?? []).map((r: any) => String(r.id));
  if (consignmentIds.length === 0) return { ok: true, value: { attributed: [] } };

  const { data, error } = await ctx.supabase
    .from("consignment_movements")
    .select("*")
    .eq("tenant_id", ctx.ws.tenant.id)
    .in("consignment_id", consignmentIds)
    .eq("movement_type", "sell")
    .eq("movement_status", "posted")
    .gte("at", input.fromIso)
    .lte("at", input.toIso)
    .order("at", { ascending: true });
  if (error) return { ok: false, error: error.message };

  const attributed: ReturnType<typeof attributeConsignmentSale>[] = [];
  for (const m of data ?? []) {
    const meta = (m.metadata as any) ?? {};
    const productId = meta.product_id == null ? "" : String(meta.product_id);
    if (!productId) continue;
    const qty = Math.abs(Number(m.qty_delta ?? 0));
    const unitCost = m.unit_cost == null ? 0 : Number(m.unit_cost);
    const unitPrice = m.unit_price == null ? 0 : Number(m.unit_price);

    attributed.push(
      attributeConsignmentSale({
        agreement: ag.value,
        movementId: String(m.id),
        occurredAt: String(m.at),
        correlationId: input.correlationId,
        currencyCode: String(m.currency_code ?? "USD"),
        lines: [{ productId, qty, unitCost, unitPrice }],
      }),
    );
  }
  return { ok: true, value: { attributed } };
}

/**
 * Settlement generation logic:
 * Creates one settlement record for an agreement + period (no partial yet).
 * Designed for Brain: uses movement ledger as facts, stores computed totals, emits events.
 */
export async function generateConsignmentSettlement(input: {
  agreementId: string;
  periodFrom: string; // YYYY-MM-DD
  periodTo: string; // YYYY-MM-DD
  notes?: string;
  correlationId: string;
}): Promise<
  Result<{
    settlementId: string;
    settlementCode: string;
    grossSalesValue: number;
    commissionValue: number;
    netDueToPrincipal: number;
    netDueToAgent: number;
    violations: string[];
  }>
> {
  const ctx = await requireCtx();
  if (!ctx.ok) return ctx;
  const ag = await getAgreement(ctx, input.agreementId);
  if (!ag.ok) return ag;

  const fromIso = `${input.periodFrom}T00:00:00.000Z`;
  const toIso = `${input.periodTo}T23:59:59.999Z`;
  const attributedRes = await attributeConsignmentSalesForPeriod({
    agreementId: input.agreementId,
    fromIso,
    toIso,
    correlationId: input.correlationId,
  });
  if (!attributedRes.ok) return attributedRes as any;

  let grossSalesValue = 0;
  let commissionValue = 0;
  let netDueToPrincipal = 0;
  let netDueToAgent = 0;
  const violations: string[] = [];

  for (const a of attributedRes.value.attributed) {
    grossSalesValue = round2(grossSalesValue + a.grossSalesValue);
    commissionValue = round2(commissionValue + a.commissionValue);
    netDueToPrincipal = round2(netDueToPrincipal + a.netDueToPrincipal);
    netDueToAgent = round2(netDueToAgent + a.netDueToAgent);
    for (const v of a.violations) violations.push(v);
  }

  const settlementCode = `CSET-${input.agreementId.slice(0, 6).toUpperCase()}-${input.periodFrom.replaceAll("-", "")}-${input.periodTo.replaceAll("-", "")}`;

  const { data, error } = await ctx.supabase
    .from("consignment_settlements")
    .insert({
      tenant_id: ctx.ws.tenant.id,
      agreement_id: input.agreementId,
      consignment_id: null,
      settlement_code: settlementCode,
      period_from: input.periodFrom,
      period_to: input.periodTo,
      status: "submitted",
      gross_sales_value: grossSalesValue,
      commission_value: commissionValue,
      net_due_to_principal: netDueToPrincipal,
      net_due_to_agent: netDueToAgent,
      currency_code: "USD",
      notes: input.notes ?? "",
      created_by: ctx.user.id,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  const settlementId = String(data.id);

  void emitConsignmentSettlementCreatedBrainEvent({
    agentId: ag.value.agentId,
    consignmentId: ag.value.id,
    productId: null,
    quantity: null,
    value: netDueToPrincipal,
    occurredAt: new Date().toISOString(),
    correlationId: input.correlationId,
    principalBranchId: null,
    stallBranchId: ag.value.stallBranchId ?? null,
    settlementId,
    payload: {
      settlement_code: settlementCode,
      agreement_id: ag.value.id,
      period_from: input.periodFrom,
      period_to: input.periodTo,
      gross_sales_value: grossSalesValue,
      commission_value: commissionValue,
      net_due_to_principal: netDueToPrincipal,
      net_due_to_agent: netDueToAgent,
      violations,
    },
  });

  return {
    ok: true,
    value: {
      settlementId,
      settlementCode,
      grossSalesValue,
      commissionValue,
      netDueToPrincipal,
      netDueToAgent,
      violations,
    },
  };
}

/**
 * Outstanding balance computation:
 * - This slice supports full settlement payment only (paid vs not paid).
 * - For partial payments later: add a `consignment_settlement_payments` table and compute paid_sum.
 */
export async function getSettlementOutstanding(input: { settlementId: string }): Promise<Result<{ outstanding: number; status: string }>> {
  const ctx = await requireCtx();
  if (!ctx.ok) return ctx;
  const { data, error } = await ctx.supabase
    .from("consignment_settlements")
    .select("id,status,net_due_to_principal")
    .eq("tenant_id", ctx.ws.tenant.id)
    .eq("id", input.settlementId)
    .single();
  if (error) return { ok: false, error: error.message };
  const status = String(data.status);
  const due = round2(Number(data.net_due_to_principal ?? 0));
  const outstanding = status === "paid" || status === "closed" ? 0 : Math.max(0, due);
  return { ok: true, value: { outstanding, status } };
}

export async function markSettlementPaid(input: {
  settlementId: string;
  remittedAmount: number;
  paymentReference?: string;
  correlationId: string;
}): Promise<Result<{ settlementId: string; mismatch?: { mismatch: "short" | "over"; delta: number } }>> {
  const ctx = await requireCtx();
  if (!ctx.ok) return ctx;
  const { data: st, error: e0 } = await ctx.supabase
    .from("consignment_settlements")
    .select("*")
    .eq("tenant_id", ctx.ws.tenant.id)
    .eq("id", input.settlementId)
    .single();
  if (e0) return { ok: false, error: e0.message };

  const expected = round2(Number(st.net_due_to_principal ?? 0));
  const paid = round2(Math.max(0, Number(input.remittedAmount) || 0));
  const mismatch = computeSettlementMismatchRule({ expectedDueToPrincipal: expected, remittedAmount: paid });

  const { error } = await ctx.supabase
    .from("consignment_settlements")
    .update({
      status: "paid",
      notes: String(st.notes ?? ""),
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", ctx.ws.tenant.id)
    .eq("id", input.settlementId);
  if (error) return { ok: false, error: error.message };

  // Emit payment event
  const ag = await getAgreement(ctx, String(st.agreement_id));
  if (ag.ok) {
    void emitConsignmentSettlementPaidBrainEvent({
      agentId: ag.value.agentId,
      consignmentId: ag.value.id,
      productId: null,
      quantity: null,
      value: paid,
      occurredAt: new Date().toISOString(),
      correlationId: input.correlationId,
      principalBranchId: null,
      stallBranchId: ag.value.stallBranchId ?? null,
      settlementId: input.settlementId,
      payload: {
        payment_reference: input.paymentReference ?? null,
        remitted_amount: paid,
        expected_due_to_principal: expected,
        mismatch: mismatch.ok ? null : mismatch,
      },
    });
  }

  return {
    ok: true,
    value: {
      settlementId: input.settlementId,
      mismatch: mismatch.ok ? undefined : { mismatch: mismatch.mismatch, delta: mismatch.delta },
    },
  };
}

export async function detectOverdueSettlements(input?: { limit?: number; emitEvents?: boolean }): Promise<
  Result<{ overdue: Array<{ settlementId: string; settlementCode: string; daysOverdue: number }> }>
> {
  const ctx = await requireCtx();
  if (!ctx.ok) return ctx;
  const limit = input?.limit ?? 200;
  const { data, error } = await ctx.supabase
    .from("consignment_settlements")
    .select("id,settlement_code,period_to,status,agreement_id")
    .eq("tenant_id", ctx.ws.tenant.id)
    .neq("status", "paid")
    .neq("status", "closed")
    .order("period_to", { ascending: true })
    .limit(limit);
  if (error) return { ok: false, error: error.message };

  const overdue: Array<{ settlementId: string; settlementCode: string; daysOverdue: number }> = [];
  for (const s of data ?? []) {
    const chk = settlementOverdueCheck({ periodToIsoDate: String(s.period_to), graceDays: 0 });
    if (!chk.overdue) continue;
    overdue.push({ settlementId: String(s.id), settlementCode: String(s.settlement_code), daysOverdue: chk.daysOverdue });

    if (input?.emitEvents) {
      const ag = await getAgreement(ctx, String(s.agreement_id));
      if (ag.ok) {
        void emitConsignmentSettlementOverdueBrainEvent({
          agentId: ag.value.agentId,
          consignmentId: ag.value.id,
          productId: null,
          quantity: null,
          value: null,
          occurredAt: new Date().toISOString(),
          correlationId: `consignment_settlement_overdue_${s.id}`,
          principalBranchId: null,
          stallBranchId: ag.value.stallBranchId ?? null,
          settlementId: String(s.id),
          daysOverdue: chk.daysOverdue,
          payload: { settlement_code: String(s.settlement_code), days_overdue: chk.daysOverdue },
        });
      }
    }
  }

  return { ok: true, value: { overdue } };
}

