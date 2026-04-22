"use server";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";
import {
  emitConsignmentReconciliationPerformedBrainEvent,
  emitConsignmentStockDamagedBrainEvent,
  emitConsignmentStockIssuedBrainEvent,
  emitConsignmentStockMissingBrainEvent,
  emitConsignmentStockReceivedBrainEvent,
  emitConsignmentStockReturnedBrainEvent,
  emitConsignmentStockSoldBrainEvent,
} from "@/modules/brain/brain-actions";
import type { ConsignmentMovementType } from "./types";
import { computeConsignmentCustodyStockPosition } from "./stock-position";

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

async function getConsignmentOrFail(ctx: Awaited<ReturnType<typeof requireCtx>>, consignmentId: string) {
  const { data, error } = await ctx.supabase
    .from("consignments")
    .select("*")
    .eq("tenant_id", ctx.ws.tenant.id)
    .eq("id", consignmentId)
    .single();
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, row: data as any };
}

async function getAgreementOrFail(ctx: Awaited<ReturnType<typeof requireCtx>>, agreementId: string) {
  const { data, error } = await ctx.supabase
    .from("consignment_agreements")
    .select("*")
    .eq("tenant_id", ctx.ws.tenant.id)
    .eq("id", agreementId)
    .single();
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, row: data as any };
}

async function listPostedMovements(ctx: Awaited<ReturnType<typeof requireCtx>>, consignmentId: string, limit = 3000) {
  const { data, error } = await ctx.supabase
    .from("consignment_movements")
    .select("*")
    .eq("tenant_id", ctx.ws.tenant.id)
    .eq("consignment_id", consignmentId)
    .eq("movement_status", "posted")
    .order("at", { ascending: true })
    .limit(limit);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, rows: (data ?? []) as any[] };
}

function requirePositiveQty(qty: number, label: string): Result<number> {
  const q = Math.floor(Number(qty));
  if (!Number.isFinite(q) || q <= 0) return { ok: false, error: `${label} must be > 0.` };
  return { ok: true, value: q };
}

function requireMoney(n: number | null | undefined, label: string): Result<number | null> {
  if (n == null) return { ok: true, value: null };
  const v = round2(Number(n));
  if (!Number.isFinite(v) || v < 0) return { ok: false, error: `${label} must be a valid non-negative number.` };
  return { ok: true, value: v };
}

async function insertMovement(ctx: Awaited<ReturnType<typeof requireCtx>>, input: {
  consignmentId: string;
  movementType: ConsignmentMovementType;
  at: string;
  fromCustody?: { type: string | null; id: string | null };
  toCustody?: { type: string | null; id: string | null };
  qtyDelta: number;
  unitCost?: number | null;
  unitPrice?: number | null;
  amountValue?: number | null;
  currencyCode?: string;
  referenceCode?: string | null;
  relatedSaleId?: string | null;
  sourceDocumentId?: string | null;
  narration?: string;
  metadata: Record<string, unknown>;
}): Promise<Result<{ id: string }>> {
  const { data, error } = await ctx.supabase
    .from("consignment_movements")
    .insert({
      tenant_id: ctx.ws.tenant.id,
      consignment_id: input.consignmentId,
      consignment_item_id: null,
      movement_type: input.movementType,
      movement_status: "posted",
      at: input.at,
      actor_user_id: ctx.user.id,
      actor_label: "user",
      from_custody_scope_type: input.fromCustody?.type ?? null,
      from_custody_scope_id: input.fromCustody?.id ?? null,
      to_custody_scope_type: input.toCustody?.type ?? null,
      to_custody_scope_id: input.toCustody?.id ?? null,
      qty_delta: input.qtyDelta,
      unit_cost: input.unitCost ?? null,
      unit_price: input.unitPrice ?? null,
      amount_value: input.amountValue ?? null,
      currency_code: input.currencyCode ?? "USD",
      reference_code: input.referenceCode ?? null,
      related_sale_id: input.relatedSaleId ?? null,
      source_document_id: input.sourceDocumentId ?? null,
      narration: input.narration ?? "",
      metadata: input.metadata ?? {},
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: { id: String(data.id) } };
}

async function getOnHandQtyForProduct(ctx: Awaited<ReturnType<typeof requireCtx>>, consignmentId: string, productId: string) {
  const m = await listPostedMovements(ctx, consignmentId);
  if (!m.ok) return m;
  const pos = computeConsignmentCustodyStockPosition({
    consignmentId,
    movements: m.rows.map((r) => ({
      movementType: r.movement_type,
      qtyDelta: Number(r.qty_delta ?? 0),
      unitCost: r.unit_cost == null ? null : Number(r.unit_cost),
      amountValue: r.amount_value == null ? null : Number(r.amount_value),
      metadata: (r.metadata as any) ?? {},
      at: String(r.at),
    })),
  });
  const line = pos.lines.find((l) => l.productId === productId);
  return { ok: true as const, value: line?.onHandQty ?? 0 };
}

/**
 * Validation rules summary (enforced by the service functions below):
 * - **issue**: qty>0, unitCost>0. Creates custody-increase (+qty) into agent/stall custody.
 * - **receive**: informational confirmation only (qty_delta=0). Cannot confirm more than current custody on-hand.
 * - **sell/return/damage/missing**: qty>0 and cannot exceed current custody on-hand. Emits a custody-decrease (-qty).
 * - **reconciliation**: snapshot expected vs counted (qty_delta=0). If variance<0 auto-emits a missing movement; if variance>0 auto-emits an adjust (+qty).
 *
 * Ownership rule:
 * - Ownership stays principal by default; custody changes only (represented by from/to custody scopes + movements).
 */

export async function issueConsignmentStockBi(input: {
  consignmentId: string;
  productId: string;
  qty: number;
  unitCost: number;
  stallBranchId?: string | null;
  referenceCode?: string | null;
  narration?: string;
  correlationId: string;
}): Promise<Result<{ movementId: string }>> {
  const ctx = await requireCtx();
  if (!ctx.ok) return ctx;
  const q = requirePositiveQty(input.qty, "Quantity");
  if (!q.ok) return q;
  const cost = requireMoney(input.unitCost, "Unit cost");
  if (!cost.ok || cost.value == null || cost.value <= 0) return { ok: false, error: "Unit cost must be > 0." };

  const c = await getConsignmentOrFail(ctx, input.consignmentId);
  if (!c.ok) return { ok: false, error: c.error };
  const ag = await getAgreementOrFail(ctx, String(c.row.agreement_id));
  if (!ag.ok) return { ok: false, error: ag.error };

  if (!["draft", "issued", "in_custody", "in_trade"].includes(String(c.row.status))) {
    return { ok: false, error: `Cannot issue stock in consignment status "${c.row.status}".` };
  }

  const at = new Date().toISOString();
  const amountValue = round2(q.value * cost.value);
  const stall = input.stallBranchId ?? (ag.row.stall_branch_id as string | null) ?? null;

  const ins = await insertMovement(ctx, {
    consignmentId: input.consignmentId,
    movementType: "issue",
    at,
    fromCustody: { type: "principal", id: String(ag.row.tenant_id ?? ctx.ws.tenant.id) },
    toCustody: { type: "branch", id: stall },
    qtyDelta: q.value,
    unitCost: cost.value,
    amountValue,
    referenceCode: input.referenceCode ?? null,
    narration: input.narration ?? `Issue to custody (${input.productId})`,
    metadata: {
      product_id: input.productId,
      qty_issued: q.value,
      unit_cost: cost.value,
      stall_branch_id: stall,
    },
  });
  if (!ins.ok) return ins;

  void emitConsignmentStockIssuedBrainEvent({
    agentId: String(ag.row.agent_id),
    consignmentId: input.consignmentId,
    productId: input.productId,
    quantity: q.value,
    value: amountValue,
    occurredAt: at,
    correlationId: input.correlationId,
    stallBranchId: stall,
    payload: { movement_id: ins.value.id, movement_type: "issue" },
  });

  return { ok: true, value: { movementId: ins.value.id } };
}

export async function receiveConsignmentStockBi(input: {
  consignmentId: string;
  productId: string;
  qtyReceived: number;
  stallBranchId?: string | null;
  referenceCode?: string | null;
  narration?: string;
  correlationId: string;
}): Promise<Result<{ movementId: string }>> {
  const ctx = await requireCtx();
  if (!ctx.ok) return ctx;
  const q = requirePositiveQty(input.qtyReceived, "Quantity received");
  if (!q.ok) return q;

  const c = await getConsignmentOrFail(ctx, input.consignmentId);
  if (!c.ok) return { ok: false, error: c.error };
  const ag = await getAgreementOrFail(ctx, String(c.row.agreement_id));
  if (!ag.ok) return { ok: false, error: ag.error };

  const stall = input.stallBranchId ?? (ag.row.stall_branch_id as string | null) ?? null;
  const onHand = await getOnHandQtyForProduct(ctx, input.consignmentId, input.productId);
  if (!onHand.ok) return { ok: false, error: onHand.error };
  if (q.value > onHand.value + 1e-9) return { ok: false, error: `Cannot receive ${q.value}; custody on-hand is ${onHand.value}.` };

  const at = new Date().toISOString();
  const ins = await insertMovement(ctx, {
    consignmentId: input.consignmentId,
    movementType: "receive",
    at,
    fromCustody: { type: "transit", id: null },
    toCustody: { type: "branch", id: stall },
    qtyDelta: 0,
    referenceCode: input.referenceCode ?? null,
    narration: input.narration ?? `Receipt confirmation (${input.productId})`,
    metadata: { product_id: input.productId, qty_received: q.value, stall_branch_id: stall },
  });
  if (!ins.ok) return ins;

  void emitConsignmentStockReceivedBrainEvent({
    agentId: String(ag.row.agent_id),
    consignmentId: input.consignmentId,
    productId: input.productId,
    quantity: q.value,
    value: null,
    occurredAt: at,
    correlationId: input.correlationId,
    stallBranchId: stall,
    payload: { movement_id: ins.value.id, movement_type: "receive" },
  });

  return { ok: true, value: { movementId: ins.value.id } };
}

async function reduceCustody(ctx: Awaited<ReturnType<typeof requireCtx>>, input: {
  movementType: "sell" | "return" | "damage" | "missing";
  consignmentId: string;
  productId: string;
  qty: number;
  unitCost?: number | null;
  unitPrice?: number | null;
  relatedSaleId?: string | null;
  referenceCode?: string | null;
  narration?: string;
  correlationId: string;
  stallBranchId?: string | null;
}) {
  const q = requirePositiveQty(input.qty, "Quantity");
  if (!q.ok) return q;
  const cost = requireMoney(input.unitCost ?? null, "Unit cost");
  if (!cost.ok) return cost;
  const price = requireMoney(input.unitPrice ?? null, "Unit price");
  if (!price.ok) return price;

  const c = await getConsignmentOrFail(ctx, input.consignmentId);
  if (!c.ok) return { ok: false as const, error: c.error };
  const ag = await getAgreementOrFail(ctx, String(c.row.agreement_id));
  if (!ag.ok) return { ok: false as const, error: ag.error };

  const onHand = await getOnHandQtyForProduct(ctx, input.consignmentId, input.productId);
  if (!onHand.ok) return { ok: false as const, error: onHand.error };
  if (q.value > onHand.value + 1e-9) {
    return { ok: false as const, error: `Cannot ${input.movementType} ${q.value}; custody on-hand is ${onHand.value}.` };
  }
  if (input.movementType === "sell" && !input.relatedSaleId && !input.referenceCode) {
    return { ok: false as const, error: "Sell movement requires relatedSaleId or referenceCode." };
  }

  const at = new Date().toISOString();
  const stall = input.stallBranchId ?? (ag.row.stall_branch_id as string | null) ?? null;
  const unitCost = cost.value ?? null;
  const amountValue = unitCost != null && unitCost > 0 ? round2(q.value * unitCost) : null;

  const ins = await insertMovement(ctx, {
    consignmentId: input.consignmentId,
    movementType: input.movementType,
    at,
    fromCustody: { type: "branch", id: stall },
    toCustody: input.movementType === "return" ? { type: "principal", id: String(ag.row.tenant_id ?? ctx.ws.tenant.id) } : { type: "sink", id: input.movementType },
    qtyDelta: -q.value,
    unitCost,
    unitPrice: price.value,
    amountValue,
    referenceCode: input.referenceCode ?? null,
    relatedSaleId: input.relatedSaleId ?? null,
    narration: input.narration ?? `${input.movementType} (${input.productId})`,
    metadata: { product_id: input.productId, qty: q.value, unit_cost: unitCost, unit_price: price.value, stall_branch_id: stall },
  });
  if (!ins.ok) return ins;

  const agentId = String(ag.row.agent_id);
  if (input.movementType === "sell") {
    void emitConsignmentStockSoldBrainEvent({
      agentId,
      consignmentId: input.consignmentId,
      productId: input.productId,
      quantity: q.value,
      value: amountValue,
      occurredAt: at,
      correlationId: input.correlationId,
      stallBranchId: stall,
      saleId: input.relatedSaleId ?? null,
      receiptNumber: input.referenceCode ?? null,
      unitCost,
      unitPrice: price.value,
      payload: { movement_id: ins.value.id, movement_type: "sell" },
    });
  } else if (input.movementType === "return") {
    void emitConsignmentStockReturnedBrainEvent({
      agentId,
      consignmentId: input.consignmentId,
      productId: input.productId,
      quantity: q.value,
      value: amountValue,
      occurredAt: at,
      correlationId: input.correlationId,
      stallBranchId: stall,
      payload: { movement_id: ins.value.id, movement_type: "return" },
    });
  } else if (input.movementType === "damage") {
    void emitConsignmentStockDamagedBrainEvent({
      agentId,
      consignmentId: input.consignmentId,
      productId: input.productId,
      quantity: q.value,
      value: amountValue,
      occurredAt: at,
      correlationId: input.correlationId,
      stallBranchId: stall,
      payload: { movement_id: ins.value.id, movement_type: "damage" },
    });
  } else if (input.movementType === "missing") {
    void emitConsignmentStockMissingBrainEvent({
      agentId,
      consignmentId: input.consignmentId,
      productId: input.productId,
      quantity: q.value,
      value: amountValue,
      occurredAt: at,
      correlationId: input.correlationId,
      stallBranchId: stall,
      payload: { movement_id: ins.value.id, movement_type: "missing" },
    });
  }

  return { ok: true as const, value: { movementId: ins.value.id } };
}

export async function sellConsignmentStockBi(input: {
  consignmentId: string;
  productId: string;
  qty: number;
  unitCost?: number | null;
  unitPrice?: number | null;
  relatedSaleId?: string | null;
  receiptNumber?: string | null;
  narration?: string;
  correlationId: string;
  stallBranchId?: string | null;
}) {
  const ctx = await requireCtx();
  if (!ctx.ok) return ctx;
  return reduceCustody(ctx, {
    movementType: "sell",
    consignmentId: input.consignmentId,
    productId: input.productId,
    qty: input.qty,
    unitCost: input.unitCost ?? null,
    unitPrice: input.unitPrice ?? null,
    relatedSaleId: input.relatedSaleId ?? null,
    referenceCode: input.receiptNumber ?? null,
    narration: input.narration,
    correlationId: input.correlationId,
    stallBranchId: input.stallBranchId ?? null,
  });
}

export async function returnConsignmentStockBi(input: {
  consignmentId: string;
  productId: string;
  qty: number;
  unitCost?: number | null;
  referenceCode?: string | null;
  narration?: string;
  correlationId: string;
  stallBranchId?: string | null;
}) {
  const ctx = await requireCtx();
  if (!ctx.ok) return ctx;
  return reduceCustody(ctx, {
    movementType: "return",
    consignmentId: input.consignmentId,
    productId: input.productId,
    qty: input.qty,
    unitCost: input.unitCost ?? null,
    unitPrice: null,
    relatedSaleId: null,
    referenceCode: input.referenceCode ?? null,
    narration: input.narration,
    correlationId: input.correlationId,
    stallBranchId: input.stallBranchId ?? null,
  });
}

export async function damageConsignmentStockBi(input: {
  consignmentId: string;
  productId: string;
  qty: number;
  unitCost?: number | null;
  referenceCode?: string | null;
  narration?: string;
  correlationId: string;
  stallBranchId?: string | null;
}) {
  const ctx = await requireCtx();
  if (!ctx.ok) return ctx;
  return reduceCustody(ctx, {
    movementType: "damage",
    consignmentId: input.consignmentId,
    productId: input.productId,
    qty: input.qty,
    unitCost: input.unitCost ?? null,
    unitPrice: null,
    relatedSaleId: null,
    referenceCode: input.referenceCode ?? null,
    narration: input.narration,
    correlationId: input.correlationId,
    stallBranchId: input.stallBranchId ?? null,
  });
}

export async function missingConsignmentStockBi(input: {
  consignmentId: string;
  productId: string;
  qty: number;
  unitCost?: number | null;
  referenceCode?: string | null;
  narration?: string;
  correlationId: string;
  stallBranchId?: string | null;
}) {
  const ctx = await requireCtx();
  if (!ctx.ok) return ctx;
  return reduceCustody(ctx, {
    movementType: "missing",
    consignmentId: input.consignmentId,
    productId: input.productId,
    qty: input.qty,
    unitCost: input.unitCost ?? null,
    unitPrice: null,
    relatedSaleId: null,
    referenceCode: input.referenceCode ?? null,
    narration: input.narration,
    correlationId: input.correlationId,
    stallBranchId: input.stallBranchId ?? null,
  });
}

export async function reconcileConsignmentStockBi(input: {
  consignmentId: string;
  productId: string;
  physicalCountQty: number;
  unitCost?: number | null;
  referenceCode?: string | null;
  notes?: string;
  correlationId: string;
  stallBranchId?: string | null;
}): Promise<Result<{ reconciliationMovementId: string; autoAdjustMovementId?: string }>> {
  const ctx = await requireCtx();
  if (!ctx.ok) return ctx;

  const c = await getConsignmentOrFail(ctx, input.consignmentId);
  if (!c.ok) return { ok: false, error: c.error };
  const ag = await getAgreementOrFail(ctx, String(c.row.agreement_id));
  if (!ag.ok) return { ok: false, error: ag.error };

  const physical = Math.max(0, Math.floor(Number(input.physicalCountQty)));
  if (!Number.isFinite(physical)) return { ok: false, error: "Physical count must be a valid number." };

  const onHand = await getOnHandQtyForProduct(ctx, input.consignmentId, input.productId);
  if (!onHand.ok) return { ok: false, error: onHand.error };

  const expected = onHand.value;
  const variance = round2(physical - expected);
  const stall = input.stallBranchId ?? (ag.row.stall_branch_id as string | null) ?? null;
  const at = new Date().toISOString();

  const recon = await insertMovement(ctx, {
    consignmentId: input.consignmentId,
    movementType: "reconciliation",
    at,
    fromCustody: { type: "branch", id: stall },
    toCustody: { type: "branch", id: stall },
    qtyDelta: 0,
    referenceCode: input.referenceCode ?? null,
    narration: input.notes ?? "Stock reconciliation",
    metadata: {
      product_id: input.productId,
      expected_qty: expected,
      physical_count_qty: physical,
      variance_qty: variance,
      unit_cost: input.unitCost ?? null,
      stall_branch_id: stall,
    },
  });
  if (!recon.ok) return { ok: false, error: recon.error };

  void emitConsignmentReconciliationPerformedBrainEvent({
    agentId: String(ag.row.agent_id),
    consignmentId: input.consignmentId,
    productId: input.productId,
    quantity: null,
    value: null,
    occurredAt: at,
    correlationId: input.correlationId,
    stallBranchId: stall,
    reconciliationId: recon.value.id,
    varianceQty: variance,
    varianceValue: null,
    payload: { movement_id: recon.value.id, expected_qty: expected, physical_count_qty: physical, variance_qty: variance },
  });

  let autoAdjustMovementId: string | undefined;
  if (Math.abs(variance) > 1e-9) {
    if (variance < 0) {
      const miss = await missingConsignmentStockBi({
        consignmentId: input.consignmentId,
        productId: input.productId,
        qty: Math.abs(variance),
        unitCost: input.unitCost ?? null,
        referenceCode: input.referenceCode ?? null,
        narration: "Auto-adjust from reconciliation (missing)",
        correlationId: input.correlationId,
        stallBranchId: stall,
      });
      if (!miss.ok) return { ok: false, error: miss.error };
      autoAdjustMovementId = miss.value.movementId;
    } else {
      const cost = requireMoney(input.unitCost ?? null, "Unit cost");
      if (!cost.ok) return { ok: false, error: cost.error };
      const unitCost = cost.value ?? null;
      const amountValue = unitCost != null && unitCost > 0 ? round2(Math.abs(variance) * unitCost) : null;
      const adj = await insertMovement(ctx, {
        consignmentId: input.consignmentId,
        movementType: "adjust",
        at,
        fromCustody: { type: "source", id: "reconciliation_surplus" },
        toCustody: { type: "branch", id: stall },
        qtyDelta: Math.abs(variance),
        unitCost,
        amountValue,
        referenceCode: input.referenceCode ?? null,
        narration: "Auto-adjust from reconciliation (surplus)",
        metadata: { product_id: input.productId, qty: Math.abs(variance), unit_cost: unitCost, stall_branch_id: stall },
      });
      if (!adj.ok) return { ok: false, error: adj.error };
      autoAdjustMovementId = adj.value.id;
    }
  }

  return { ok: true, value: { reconciliationMovementId: recon.value.id, autoAdjustMovementId } };
}

