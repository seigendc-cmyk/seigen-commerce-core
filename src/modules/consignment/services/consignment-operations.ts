import type { Id } from "@/modules/inventory/types/models";
import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";
import { getConsignmentAgreementByStallBranchId, getConsignmentAgreement } from "@/modules/consignment/services/consignment-agreements";
import { appendConsignmentCustodyEntry, latestInvoiceUnitCostForStallProduct } from "@/modules/consignment/services/consignment-custody-ledger";
import { recordDebtorCreditInvoice } from "@/modules/financial/services/debtors-ledger";

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
}

