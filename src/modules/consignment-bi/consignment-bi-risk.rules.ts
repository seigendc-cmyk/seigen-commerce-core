import type { ConsignmentAgreementRow, ConsignmentMovementRow, ConsignmentSettlementRow } from "./types";

export type ConsignmentRiskSeverity = "low" | "medium" | "high" | "critical";
export type ConsignmentRuleDecisionKind = "warning" | "block" | "approval_required";

export type ConsignmentRiskRuleOutput = {
  ruleCode: string;
  severity: ConsignmentRiskSeverity;
  decision: ConsignmentRuleDecisionKind;
  flagCode: string;
  title: string;
  summary: string;
  evidence: Record<string, unknown>;
  approvalPolicyCode?: string;
  permissionKey?: string;
  actionTasks?: Array<{ code: string; label: string; hint?: string }>;
};

export type ConsignmentRiskRuleContext = {
  nowIso: string;
  agreement: ConsignmentAgreementRow;
  movements: ConsignmentMovementRow[];
  settlements: ConsignmentSettlementRow[];
  /**
   * Recent settlement payment events (Brain event payload extracts).
   * Provided by risk service by reading `brain_events`.
   */
  settlementPayments: Array<{
    settlementId: string;
    at: string;
    expectedDueToPrincipal: number;
    remittedAmount: number;
    mismatch: null | { mismatch: "short" | "over"; delta: number };
  }>;
  agentTrust?: { reliabilityScore: number | null; settlementDisciplineScore: number | null; scorePeriod: string | null } | null;
  custodyOnHandByProductId: Map<string, number>;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  return Math.floor(Math.abs(a - b) / (24 * 60 * 60 * 1000));
}

export const CONSIGNMENT_RISK_RULES = {
  soldBelowMinimum(ctx: ConsignmentRiskRuleContext): ConsignmentRiskRuleOutput[] {
    const out: ConsignmentRiskRuleOutput[] = [];
    for (const m of ctx.movements) {
      if (m.movementType !== "sell" || m.movementStatus !== "posted") continue;
      const productId = String((m.metadata as any)?.product_id ?? "");
      if (!productId) continue;
      const unitPrice = m.unitPrice == null ? 0 : num(m.unitPrice);
      const unitCost = m.unitCost == null ? 0 : num(m.unitCost);

      // Re-evaluate min price rule quickly (we do not block sale retroactively; we create a risk+approval task).
      const rule = ctx.agreement.minimumPriceRule;
      let violated = false;
      let minAllowed = 0;
      if (rule === "min_price") {
        minAllowed = ctx.agreement.minimumPrice == null ? 0 : num(ctx.agreement.minimumPrice);
        violated = minAllowed > 0 && unitPrice + 1e-9 < minAllowed;
      } else if (rule === "min_margin") {
        const margin = ctx.agreement.minimumMarginPercent == null ? 0 : num(ctx.agreement.minimumMarginPercent);
        minAllowed = round2(unitCost * (1 + margin / 100));
        violated = margin > 0 && unitPrice + 1e-9 < minAllowed;
      }

      if (!violated) continue;
      out.push({
        ruleCode: "consignment.sold_below_minimum",
        severity: "high",
        decision: "approval_required",
        flagCode: "CONSIGNMENT_SOLD_BELOW_MIN_PRICE",
        title: "Consignment sold below minimum price",
        summary: `Product ${productId} was sold at ${unitPrice.toFixed(2)} below minimum ${minAllowed.toFixed(2)}.`,
        evidence: {
          movementId: m.id,
          occurredAt: m.at,
          productId,
          unitPrice,
          unitCost,
          minRule: rule,
          minAllowed,
          receipt: m.referenceCode ?? null,
          relatedSaleId: m.relatedSaleId ?? null,
        },
        approvalPolicyCode: "consignment_price_violation_review",
        permissionKey: "consignment.sale.price_violation.review",
        actionTasks: [
          { code: "review_receipt", label: "Review receipt and pricing", hint: "Confirm price override/discount and staff identity." },
          { code: "raise_dispute", label: "Open dispute if needed", hint: "If price violates agreement, open a dispute and agree recovery." },
        ],
      });
    }
    return out;
  },

  delayedSettlement(ctx: ConsignmentRiskRuleContext): ConsignmentRiskRuleOutput[] {
    const out: ConsignmentRiskRuleOutput[] = [];
    const grace = Math.max(0, Math.floor(ctx.agreement.settlementGraceDays ?? 0));
    for (const s of ctx.settlements) {
      if (s.status === "paid" || s.status === "closed" || s.status === "rejected") continue;
      const due = new Date(`${s.periodTo}T00:00:00.000Z`).getTime() + grace * 24 * 60 * 60 * 1000;
      const now = new Date(ctx.nowIso).getTime();
      if (now <= due) continue;
      const daysOverdue = Math.floor((now - due) / (24 * 60 * 60 * 1000));
      out.push({
        ruleCode: "consignment.settlement.delayed",
        severity: daysOverdue >= 7 ? "high" : "medium",
        decision: "warning",
        flagCode: "CONSIGNMENT_SETTLEMENT_OVERDUE",
        title: "Consignment settlement overdue",
        summary: `Settlement ${s.settlementCode} is overdue by ${daysOverdue} day(s).`,
        evidence: { settlementId: s.id, settlementCode: s.settlementCode, periodTo: s.periodTo, graceDays: grace, daysOverdue, status: s.status },
        actionTasks: [{ code: "contact_agent", label: "Contact agent for settlement", hint: "Request proof of payment or schedule immediate remittance." }],
      });
    }
    return out;
  },

  repeatedUnderRemittance(ctx: ConsignmentRiskRuleContext): ConsignmentRiskRuleOutput[] {
    const short = ctx.settlementPayments.filter((p) => p.mismatch?.mismatch === "short");
    if (short.length < 2) return [];
    const recent = short.slice(-5);
    const totalDelta = round2(recent.reduce((a, x) => a + Math.abs(x.mismatch?.delta ?? 0), 0));
    return [
      {
        ruleCode: "consignment.settlement.repeated_under_remit",
        severity: totalDelta >= 500 ? "critical" : "high",
        decision: "approval_required",
        flagCode: "CONSIGNMENT_REPEATED_UNDER_REMITTANCE",
        title: "Repeated under-remittance detected",
        summary: `Detected ${short.length} under-remittance event(s). Recent shortfall total: ${totalDelta.toFixed(2)}.`,
        evidence: { count: short.length, recent: recent.map((r) => ({ settlementId: r.settlementId, at: r.at, delta: r.mismatch?.delta })) },
        approvalPolicyCode: "consignment_under_remittance_review",
        permissionKey: "consignment.settlement.under_remittance.review",
        actionTasks: [
          { code: "freeze_new_issues", label: "Freeze new consignment issues", hint: "Prevent further exposure until reviewed." },
          { code: "require_stepup", label: "Require step-up for remittance approvals", hint: "Tighten controls for this agent/stall." },
        ],
      },
    ];
  },

  repeatedStockDiscrepancies(ctx: ConsignmentRiskRuleContext): ConsignmentRiskRuleOutput[] {
    const recon = ctx.movements.filter((m) => m.movementType === "reconciliation" && m.movementStatus === "posted");
    const mismatches = recon
      .map((m) => ({ id: m.id, at: m.at, varianceQty: num((m.metadata as any)?.variance_qty) }))
      .filter((x) => Math.abs(x.varianceQty) >= 1);
    if (mismatches.length < 2) return [];
    return [
      {
        ruleCode: "consignment.reconciliation.repeated_mismatch",
        severity: "high",
        decision: "warning",
        flagCode: "CONSIGNMENT_REPEATED_STOCK_DISCREPANCY",
        title: "Repeated stock discrepancies",
        summary: `Detected ${mismatches.length} reconciliation mismatch event(s) (variance ≥ 1).`,
        evidence: { mismatches: mismatches.slice(-10) },
        actionTasks: [{ code: "audit_custody", label: "Audit custody trail", hint: "Review issue/sell/return/damage/missing movements for patterns." }],
      },
    ];
  },

  repeatedDamageClaims(ctx: ConsignmentRiskRuleContext): ConsignmentRiskRuleOutput[] {
    const damage = ctx.movements.filter((m) => m.movementType === "damage" && m.movementStatus === "posted");
    if (damage.length < 3) return [];
    return [
      {
        ruleCode: "consignment.damage.repeated",
        severity: "medium",
        decision: "warning",
        flagCode: "CONSIGNMENT_REPEATED_DAMAGE",
        title: "Repeated damage claims",
        summary: `Damage claims recorded ${damage.length} time(s) for this agreement.`,
        evidence: { recent: damage.slice(-10).map((m) => ({ id: m.id, at: m.at, productId: (m.metadata as any)?.product_id ?? null, qty: Math.abs(m.qtyDelta) })) },
        actionTasks: [{ code: "inspect_storage", label: "Inspect stall storage handling", hint: "Check packaging/storage practices and staff behavior." }],
      },
    ];
  },

  manualAdjustment(ctx: ConsignmentRiskRuleContext): ConsignmentRiskRuleOutput[] {
    const adj = ctx.movements.filter((m) => m.movementType === "adjust" && m.movementStatus === "posted");
    if (adj.length === 0) return [];
    return [
      {
        ruleCode: "consignment.stock.manual_adjustment",
        severity: "high",
        decision: "approval_required",
        flagCode: "CONSIGNMENT_MANUAL_ADJUSTMENT",
        title: "Manual adjustment on consignment custody",
        summary: `Manual adjustments were posted ${adj.length} time(s).`,
        evidence: { adjustments: adj.slice(-10).map((m) => ({ id: m.id, at: m.at, productId: (m.metadata as any)?.product_id ?? null, qtyDelta: m.qtyDelta, amount: m.amountValue ?? null })) },
        approvalPolicyCode: "consignment_adjustment_review",
        permissionKey: "consignment.stock.adjustment.review",
        actionTasks: [{ code: "require_evidence", label: "Require evidence", hint: "Attach stocktake sheet/photos and manager sign-off." }],
      },
    ];
  },

  largeIssueToLowTrustAgent(ctx: ConsignmentRiskRuleContext): ConsignmentRiskRuleOutput[] {
    const issues = ctx.movements.filter((m) => m.movementType === "issue" && m.movementStatus === "posted");
    if (issues.length === 0) return [];
    const trust = ctx.agentTrust?.reliabilityScore;
    const isLowTrust = trust == null ? true : trust < 40;
    const isNewAgreement = daysBetween(ctx.agreement.createdAt, ctx.nowIso) <= 14;
    const large = issues
      .map((m) => ({ id: m.id, at: m.at, amount: num(m.amountValue), qty: num(m.qtyDelta) }))
      .filter((x) => x.amount >= 1000 || x.qty >= 50);
    if (!isLowTrust && !isNewAgreement) return [];
    if (large.length === 0) return [];

    return [
      {
        ruleCode: "consignment.issue.large_low_trust",
        severity: "critical",
        decision: "approval_required",
        flagCode: "CONSIGNMENT_LARGE_ISSUE_LOW_TRUST",
        title: "Large consignment issued to new/low-trust agent",
        summary: `Large issues detected (${large.length}). Agent trust: ${trust ?? "unknown"}; agreement new: ${isNewAgreement}.`,
        evidence: { trust, isNewAgreement, large: large.slice(-10) },
        approvalPolicyCode: "consignment_large_issue_review",
        permissionKey: "consignment.stock.large_issue.review",
        actionTasks: [
          { code: "verify_agent", label: "Verify agent and custody capacity", hint: "Confirm stall security, cash handling, and inventory controls." },
          { code: "limit_exposure", label: "Limit exposure", hint: "Set caps or require per-issue approval until trust improves." },
        ],
      },
    ];
  },

  agreementExpiredStockActive(ctx: ConsignmentRiskRuleContext): ConsignmentRiskRuleOutput[] {
    const expiry = ctx.agreement.expiryDate;
    if (!expiry) return [];
    const expired = expiry < ctx.nowIso.slice(0, 10);
    if (!expired) return [];
    let onHandTotal = 0;
    for (const v of ctx.custodyOnHandByProductId.values()) onHandTotal += v;
    if (onHandTotal <= 0) return [];
    return [
      {
        ruleCode: "consignment.agreement.expired_stock_active",
        severity: "high",
        decision: "block",
        flagCode: "CONSIGNMENT_EXPIRED_STOCK_ACTIVE",
        title: "Agreement expired but stock still active",
        summary: `Agreement expired (${expiry}) but custody still has stock on-hand (${onHandTotal}).`,
        evidence: { expiryDate: expiry, onHandTotal },
        actionTasks: [{ code: "close_out", label: "Close out / return stock", hint: "Stop further sales, reconcile, and return stock to principal or renew agreement." }],
      },
    ];
  },
} as const;

