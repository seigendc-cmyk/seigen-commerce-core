import type { Id } from "@/modules/inventory/types/models";
import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";
import { getConsignmentAgreementByStallBranchId, getConsignmentAgreement } from "@/modules/consignment/services/consignment-agreements";
import { appendConsignmentCustodyEntry, latestInvoiceUnitCostForStallProduct } from "@/modules/consignment/services/consignment-custody-ledger";
import { recordDebtorCreditInvoice } from "@/modules/financial/services/debtors-ledger";
import { requireStockOpsBranch, requireTradingBranch } from "@/modules/inventory/services/stock-mutation-policy";
import {
  emitConsignmentStockIssuedBrainEvent,
  emitConsignmentStockMissingBrainEvent,
  emitConsignmentStockSoldBrainEvent,
} from "@/modules/brain/brain-actions";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function isConsignmentStallBranch(branchId: Id): boolean {
  return Boolean(getConsignmentAgreementByStallBranchId(branchId));
}

export function consignmentAgentPricingForProduct(branchId: Id, productId: Id): number | null {
  const ag = getConsignmentAgreementByStallBranchId(branchId);
  if (!ag) return null;
  const invoiceCost = latestInvoiceUnitCostForStallProduct(ag.stallBranchId, productId);
  if (invoiceCost == null) return null;
  const premium = Math.max(0, ag.premiumPercent) / 100;
  return round2(invoiceCost * (1 + premium));
}

/**
 * Direct issue helper (legacy / tests). Prefer the consignment issue invoice module so stock only becomes
 * sellable at the agent stall after formal invoice, approval, and posting.
 */
export function issueConsignmentStock(input: {
  agreementId: string;
  productId: Id;
  qty: number;
  invoiceUnitCost: number;
  ref?: string;
  memo?: string;
}): { ok: true } | { ok: false; error: string } {
  const ag = getConsignmentAgreement(input.agreementId);
  if (!ag || !ag.isActive) return { ok: false, error: "Agreement not found or inactive." };

  // Guardrails: principal must be a stock-ops branch (warehouse or trading), stall must be a trading branch.
  const principal = requireStockOpsBranch(ag.principalBranchId, "Principal branch cannot hold consignment stock.");
  if (!principal.ok) return { ok: false, error: principal.error };
  const stall = requireTradingBranch(ag.stallBranchId, "Consignment stall must be a trading branch (not head office).");
  if (!stall.ok) return { ok: false, error: stall.error };

  const qty = Math.floor(Number(input.qty));
  const cost = round2(Number(input.invoiceUnitCost));
  if (!Number.isFinite(qty) || qty <= 0) return { ok: false, error: "Quantity must be > 0." };
  if (!Number.isFinite(cost) || cost <= 0) return { ok: false, error: "Invoice unit cost must be > 0." };

  const principalOnHand = InventoryRepo.getStock(ag.principalBranchId, input.productId)?.onHandQty ?? 0;
  if (principalOnHand + 1e-9 < qty) {
    return { ok: false, error: `Insufficient principal stock: have ${principalOnHand}, need ${qty}.` };
  }

  InventoryRepo.incrementStock(ag.principalBranchId, input.productId, -qty);
  InventoryRepo.incrementStock(ag.stallBranchId, input.productId, qty);

  appendConsignmentCustodyEntry({
    agreementId: ag.id,
    stallBranchId: ag.stallBranchId,
    principalBranchId: ag.principalBranchId,
    agentId: ag.agentId,
    agentName: ag.agentName,
    productId: input.productId,
    qtyDelta: qty,
    invoiceUnitCost: cost,
    kind: "issue_to_agent",
    ref: input.ref,
    memo: input.memo,
  });

  // Brain event (append-only): consignment stock issued to agent custody
  void emitConsignmentStockIssuedBrainEvent({
    agentId: ag.agentId,
    consignmentId: ag.id,
    productId: input.productId,
    quantity: qty,
    value: round2(qty * cost),
    occurredAt: new Date().toISOString(),
    correlationId: `consignment_issue_${ag.id}_${input.productId}_${Date.now()}`,
    principalBranchId: ag.principalBranchId,
    stallBranchId: ag.stallBranchId,
    payload: {
      kind: "issue_to_agent",
      ref: input.ref ?? null,
      memo: input.memo ?? null,
      invoice_unit_cost: cost,
      agreement_id: ag.id,
    },
  });

  return { ok: true };
}

/**
 * When agent sells, agent becomes a debtor to principal at invoice value.
 * Premium is agent margin and not posted as payable to principal.
 */
export function postAgentDebtorFromConsignmentSale(input: {
  saleId: string;
  receiptNumber: string;
  createdAt: string;
  stallBranchId: Id;
  lines: Array<{ productId: Id; qty: number }>;
}): void {
  const ag = getConsignmentAgreementByStallBranchId(input.stallBranchId);
  if (!ag) return;

  let totalInvoiceValue = 0;
  for (const l of input.lines) {
    const unit = latestInvoiceUnitCostForStallProduct(ag.stallBranchId, l.productId) ?? 0;
    if (unit <= 0) continue;
    totalInvoiceValue = round2(totalInvoiceValue + unit * l.qty);
    appendConsignmentCustodyEntry({
      agreementId: ag.id,
      stallBranchId: ag.stallBranchId,
      principalBranchId: ag.principalBranchId,
      agentId: ag.agentId,
      agentName: ag.agentName,
      productId: l.productId,
      qtyDelta: -l.qty,
      invoiceUnitCost: unit,
      kind: "sale",
      ref: input.receiptNumber,
      memo: `POS sale ${input.receiptNumber}`,
      createdAt: input.createdAt,
    });

    // Brain event (append-only): consignment stock sold from agent custody.
    void emitConsignmentStockSoldBrainEvent({
      agentId: ag.agentId,
      consignmentId: ag.id,
      productId: l.productId,
      quantity: l.qty,
      value: round2(unit * l.qty),
      occurredAt: input.createdAt,
      correlationId: `consignment_sale_${input.saleId}_${l.productId}`,
      principalBranchId: ag.principalBranchId,
      stallBranchId: ag.stallBranchId,
      saleId: input.saleId,
      receiptNumber: input.receiptNumber,
      unitCost: unit,
      payload: {
        kind: "sale",
        agreement_id: ag.id,
        principal_branch_id: ag.principalBranchId,
        stall_branch_id: ag.stallBranchId,
      },
    });
  }

  if (totalInvoiceValue > 0) {
    recordDebtorCreditInvoice({
      customerId: ag.agentId,
      customerName: ag.agentName,
      amount: totalInvoiceValue,
      reference: `Consignment sale · ${input.receiptNumber}`,
      saleId: input.saleId,
      paymentTermsDays: 0,
    });
  }
}

/**
 * Shortages at stall are agent responsibility at invoice value.
 * Call this when a stock adjustment posts a negative variance for a product at stall branch.
 */
export function postAgentDebtorForShortage(input: {
  stallBranchId: Id;
  productId: Id;
  qtyShort: number;
  reference: string;
  createdAt?: string;
}): void {
  const ag = getConsignmentAgreementByStallBranchId(input.stallBranchId);
  if (!ag) return;
  const qty = Math.floor(Math.abs(input.qtyShort));
  if (qty <= 0) return;
  const unit = latestInvoiceUnitCostForStallProduct(ag.stallBranchId, input.productId) ?? 0;
  if (unit <= 0) return;
  const total = round2(unit * qty);
  recordDebtorCreditInvoice({
    customerId: ag.agentId,
    customerName: ag.agentName,
    amount: total,
    reference: `Consignment shortage · ${input.reference}`,
    paymentTermsDays: 0,
  });
  appendConsignmentCustodyEntry({
    agreementId: ag.id,
    stallBranchId: ag.stallBranchId,
    principalBranchId: ag.principalBranchId,
    agentId: ag.agentId,
    agentName: ag.agentName,
    productId: input.productId,
    qtyDelta: -qty,
    invoiceUnitCost: unit,
    kind: "loss",
    ref: input.reference,
    memo: "Shortage (stock adjustment)",
    createdAt: input.createdAt,
  });

  // Brain event (append-only): consignment stock missing/shortage at agent stall.
  void emitConsignmentStockMissingBrainEvent({
    agentId: ag.agentId,
    consignmentId: ag.id,
    productId: input.productId,
    quantity: qty,
    value: total,
    occurredAt: input.createdAt ?? new Date().toISOString(),
    correlationId: `consignment_missing_${ag.id}_${input.productId}_${input.reference}`,
    principalBranchId: ag.principalBranchId,
    stallBranchId: ag.stallBranchId,
    payload: {
      kind: "loss",
      reference: input.reference,
      memo: "Shortage (stock adjustment)",
      invoice_unit_cost: unit,
      agreement_id: ag.id,
    },
  });
}

