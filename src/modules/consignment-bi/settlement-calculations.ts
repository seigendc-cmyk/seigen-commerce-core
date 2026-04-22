import type { ConsignmentAgreementRow } from "./types";

export type CommissionModelResolved = "percent_of_sale" | "fixed_per_unit" | "premium_above_base";

export type AttributedConsignmentSaleLine = {
  productId: string;
  qty: number;
  unitCost: number; // principal base / invoice unit cost
  unitPrice: number; // sale price at agent
  gross: number;
  principalShare: number;
  agentEarnings: number;
  violations: string[];
};

export type AttributedConsignmentSale = {
  agreementId: string;
  agentId: string;
  principalVendorName?: string;
  currencyCode: string;
  movementId: string;
  occurredAt: string;
  correlationId: string;
  lines: AttributedConsignmentSaleLine[];
  grossSalesValue: number;
  commissionValue: number;
  netDueToPrincipal: number;
  netDueToAgent: number;
  violations: string[];
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function requireFinitePositive(n: unknown, fallback = 0): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return v;
}

export function resolveCommissionModel(agreement: ConsignmentAgreementRow): CommissionModelResolved {
  // Map BI agreement to requested models:
  // - fixed_per_unit: uses commissionFixedPerUnit
  // - percent_of_sale: uses commissionPercent
  // - premium_above_base: stored in agreement.metadata.premium_above_base === true
  const meta = (agreement.metadata ?? {}) as Record<string, unknown>;
  if (meta.premium_above_base === true) return "premium_above_base";
  if (agreement.commissionModel === "fixed_per_unit") return "fixed_per_unit";
  return "percent_of_sale";
}

export function enforceMinimumPrice(input: {
  agreement: ConsignmentAgreementRow;
  unitCost: number;
  unitPrice: number;
}): { ok: true } | { ok: false; rule: string; message: string } {
  const rule = input.agreement.minimumPriceRule;
  if (rule === "none") return { ok: true };
  const price = requireFinitePositive(input.unitPrice, 0);
  const unitCost = requireFinitePositive(input.unitCost, 0);

  if (rule === "min_price") {
    const min = input.agreement.minimumPrice == null ? 0 : requireFinitePositive(input.agreement.minimumPrice, 0);
    if (min > 0 && price + 1e-9 < min) return { ok: false, rule, message: `Unit price ${price} is below minimum price ${min}.` };
    return { ok: true };
  }

  if (rule === "min_margin") {
    const m = input.agreement.minimumMarginPercent == null ? 0 : requireFinitePositive(input.agreement.minimumMarginPercent, 0);
    if (m <= 0) return { ok: true };
    const minPrice = round2(unitCost * (1 + m / 100));
    if (price + 1e-9 < minPrice) return { ok: false, rule, message: `Unit price ${price} is below minimum margin price ${minPrice} (cost ${unitCost}, margin ${m}%).` };
    return { ok: true };
  }

  return { ok: true };
}

export function computeSharesForLine(input: {
  agreement: ConsignmentAgreementRow;
  qty: number;
  unitCost: number;
  unitPrice: number;
}): { principalShare: number; agentEarnings: number; commissionValue: number; violations: string[] } {
  const violations: string[] = [];
  const qty = Math.max(0, Math.floor(requireFinitePositive(input.qty, 0)));
  const unitCost = round2(Math.max(0, requireFinitePositive(input.unitCost, 0)));
  const unitPrice = round2(Math.max(0, requireFinitePositive(input.unitPrice, 0)));
  const gross = round2(qty * unitPrice);
  const base = round2(qty * unitCost);

  const min = enforceMinimumPrice({ agreement: input.agreement, unitCost, unitPrice });
  if (!min.ok) violations.push(`min_price_violation:${min.rule}`);

  const model = resolveCommissionModel(input.agreement);

  if (model === "premium_above_base") {
    // Premium model: principal receives base (cost basis), agent earns the premium above base.
    const premium = round2(Math.max(0, gross - base));
    return {
      principalShare: base,
      agentEarnings: premium,
      commissionValue: premium,
      violations,
    };
  }

  if (model === "fixed_per_unit") {
    const fixed = input.agreement.commissionFixedPerUnit == null ? 0 : round2(Math.max(0, requireFinitePositive(input.agreement.commissionFixedPerUnit, 0)));
    const commission = round2(qty * fixed);
    const principal = round2(Math.max(0, gross - commission));
    return { principalShare: principal, agentEarnings: commission, commissionValue: commission, violations };
  }

  // percent_of_sale (default)
  const pct = input.agreement.commissionPercent == null ? 0 : round2(Math.max(0, requireFinitePositive(input.agreement.commissionPercent, 0)));
  const commission = round2((gross * pct) / 100);
  const principal = round2(Math.max(0, gross - commission));
  return { principalShare: principal, agentEarnings: commission, commissionValue: commission, violations };
}

export function attributeConsignmentSale(input: {
  agreement: ConsignmentAgreementRow;
  movementId: string;
  occurredAt: string;
  correlationId: string;
  currencyCode: string;
  lines: Array<{ productId: string; qty: number; unitCost: number; unitPrice: number }>;
}): AttributedConsignmentSale {
  const attributedLines: AttributedConsignmentSaleLine[] = [];
  const violations: string[] = [];

  let grossSalesValue = 0;
  let commissionValue = 0;
  let netDueToPrincipal = 0;
  let netDueToAgent = 0;

  for (const l of input.lines) {
    const qty = Math.max(0, Math.floor(requireFinitePositive(l.qty, 0)));
    const unitCost = round2(Math.max(0, requireFinitePositive(l.unitCost, 0)));
    const unitPrice = round2(Math.max(0, requireFinitePositive(l.unitPrice, 0)));
    const gross = round2(qty * unitPrice);
    const shares = computeSharesForLine({ agreement: input.agreement, qty, unitCost, unitPrice });

    grossSalesValue = round2(grossSalesValue + gross);
    commissionValue = round2(commissionValue + shares.commissionValue);
    netDueToPrincipal = round2(netDueToPrincipal + shares.principalShare);
    netDueToAgent = round2(netDueToAgent + shares.agentEarnings);
    for (const v of shares.violations) violations.push(v);

    attributedLines.push({
      productId: l.productId,
      qty,
      unitCost,
      unitPrice,
      gross,
      principalShare: shares.principalShare,
      agentEarnings: shares.agentEarnings,
      violations: shares.violations,
    });
  }

  return {
    agreementId: input.agreement.id,
    agentId: input.agreement.agentId,
    principalVendorName: input.agreement.principalVendorName,
    currencyCode: input.currencyCode,
    movementId: input.movementId,
    occurredAt: input.occurredAt,
    correlationId: input.correlationId,
    lines: attributedLines,
    grossSalesValue,
    commissionValue,
    netDueToPrincipal,
    netDueToAgent,
    violations,
  };
}

export function settlementOverdueCheck(input: {
  periodToIsoDate: string; // YYYY-MM-DD
  graceDays: number;
  nowIso?: string;
}): { overdue: boolean; daysOverdue: number } {
  const now = input.nowIso ? new Date(input.nowIso) : new Date();
  const base = new Date(`${input.periodToIsoDate}T00:00:00.000Z`);
  const due = new Date(base.getTime() + Math.max(0, Math.floor(input.graceDays)) * 24 * 60 * 60 * 1000);
  const diffDays = Math.floor((now.getTime() - due.getTime()) / (24 * 60 * 60 * 1000));
  return { overdue: diffDays > 0, daysOverdue: Math.max(0, diffDays) };
}

export function computeSettlementMismatchRule(input: {
  expectedDueToPrincipal: number;
  remittedAmount: number;
  tolerance?: number;
}): { ok: true } | { ok: false; mismatch: "short" | "over"; delta: number } {
  const tol = input.tolerance == null ? 0.01 : Math.max(0, Number(input.tolerance));
  const expected = round2(Math.max(0, Number(input.expectedDueToPrincipal) || 0));
  const paid = round2(Math.max(0, Number(input.remittedAmount) || 0));
  const delta = round2(paid - expected);
  if (Math.abs(delta) <= tol) return { ok: true };
  return { ok: false, mismatch: delta < 0 ? "short" : "over", delta };
}

