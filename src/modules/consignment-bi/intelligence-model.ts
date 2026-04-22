import type { ConsignmentAgreementRow, ConsignmentMovementRow, ConsignmentRiskFlagRow, ConsignmentSettlementRow } from "./types";

export type ScoreBand = "excellent" | "good" | "watch" | "risky" | "blocked";

export type ConsignmentAgentIntelligenceInput = {
  nowIso: string;
  agreement: ConsignmentAgreementRow;
  movements: ConsignmentMovementRow[];
  settlements: ConsignmentSettlementRow[];
  riskFlags: ConsignmentRiskFlagRow[];
  disputeEvents: Array<{ at: string; disputeId: string; kind?: string | null }>;
};

export type StockAgingLine = {
  productId: string;
  onHandQty: number;
  daysSinceLastSale: number | null;
  daysSinceFirstIssue: number | null;
  deadStock: boolean;
};

export type ConsignmentAgentScores = {
  score: number; // 0-100
  band: ScoreBand;
  reliabilityScore: number; // trust score (0-100)
  salesVelocityScore: number; // sell-through / velocity (0-100)
  shrinkageRiskScore: number; // 0-100 where higher = safer (low shrinkage)
  settlementDisciplineScore: number; // 0-100 (timeliness + remittance correctness)
  pricingDisciplineScore: number; // 0-100
  disputeFrequencyScore: number; // 0-100
  stockAgingScore: number; // 0-100
  sellThroughRate: number; // 0-1
  deadStockCount: number;
  deadStockQty: number;
  metrics: Record<string, unknown>;
};

export type Recommendation =
  | { code: "recall_stock"; severity: "urgent" | "critical"; title: string; rationale: string; evidence: Record<string, unknown> }
  | { code: "redistribute_to_stronger_agent"; severity: "warning" | "urgent"; title: string; rationale: string; evidence: Record<string, unknown> }
  | { code: "discount_strategically"; severity: "warning"; title: string; rationale: string; evidence: Record<string, unknown> }
  | { code: "bundle_stock"; severity: "warning"; title: string; rationale: string; evidence: Record<string, unknown> }
  | { code: "stop_issuing_new_stock"; severity: "urgent" | "critical"; title: string; rationale: string; evidence: Record<string, unknown> };

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function clamp100(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, x));
}

function daysBetweenIso(aIso: string, bIso: string): number {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  return Math.floor(Math.abs(a - b) / (24 * 60 * 60 * 1000));
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function computeStockAging(input: {
  nowIso: string;
  movements: ConsignmentMovementRow[];
  deadStockDays?: number;
}): { lines: StockAgingLine[]; deadStockCount: number; deadStockQty: number } {
  const deadStockDays = Math.max(7, Math.floor(input.deadStockDays ?? 45));
  const byProduct = new Map<string, { onHand: number; firstIssueAt: string | null; lastSaleAt: string | null }>();

  for (const m of input.movements) {
    if (m.movementStatus !== "posted") continue;
    const productId = String((m.metadata as any)?.product_id ?? "");
    if (!productId) continue;
    if (!byProduct.has(productId)) byProduct.set(productId, { onHand: 0, firstIssueAt: null, lastSaleAt: null });
    const s = byProduct.get(productId)!;

    if (m.movementType === "issue" && m.qtyDelta > 0) {
      s.onHand += num(m.qtyDelta);
      if (!s.firstIssueAt || m.at < s.firstIssueAt) s.firstIssueAt = m.at;
    }
    if (m.movementType === "adjust") {
      s.onHand += num(m.qtyDelta);
    }
    if (m.movementType === "sell" || m.movementType === "return" || m.movementType === "damage" || m.movementType === "missing") {
      s.onHand -= Math.abs(num(m.qtyDelta));
    }
    if (m.movementType === "sell") {
      if (!s.lastSaleAt || m.at > s.lastSaleAt) s.lastSaleAt = m.at;
    }
  }

  let deadStockCount = 0;
  let deadStockQty = 0;
  const lines: StockAgingLine[] = [];

  for (const [productId, s] of byProduct.entries()) {
    const onHandQty = round2(s.onHand);
    if (onHandQty <= 0) continue;
    const daysSinceLastSale = s.lastSaleAt ? daysBetweenIso(s.lastSaleAt, input.nowIso) : null;
    const daysSinceFirstIssue = s.firstIssueAt ? daysBetweenIso(s.firstIssueAt, input.nowIso) : null;
    const deadStock = (daysSinceLastSale ?? deadStockDays + 1) >= deadStockDays;
    if (deadStock) {
      deadStockCount += 1;
      deadStockQty += onHandQty;
    }
    lines.push({ productId, onHandQty, daysSinceLastSale, daysSinceFirstIssue, deadStock });
  }

  lines.sort((a, b) => (b.daysSinceLastSale ?? 9999) - (a.daysSinceLastSale ?? 9999));
  return { lines, deadStockCount, deadStockQty: round2(deadStockQty) };
}

export function computeSellThroughRate(input: { movements: ConsignmentMovementRow[] }): number {
  let issued = 0;
  let sold = 0;
  for (const m of input.movements) {
    if (m.movementStatus !== "posted") continue;
    const pid = (m.metadata as any)?.product_id;
    if (!pid) continue;
    if (m.movementType === "issue") issued += Math.max(0, num(m.qtyDelta));
    if (m.movementType === "sell") sold += Math.abs(num(m.qtyDelta));
  }
  if (issued <= 0) return 0;
  return clamp01(sold / issued);
}

export function computeSettlementTimelinessScore(input: { settlements: ConsignmentSettlementRow[]; graceDays: number; nowIso: string }): number {
  const grace = Math.max(0, Math.floor(input.graceDays));
  const relevant = input.settlements.filter((s) => s.status !== "rejected");
  if (relevant.length === 0) return 70;
  let points = 0;
  for (const s of relevant.slice(-12)) {
    const due = new Date(`${s.periodTo}T00:00:00.000Z`).getTime() + grace * 24 * 60 * 60 * 1000;
    const now = new Date(input.nowIso).getTime();
    const overdueDays = Math.max(0, Math.floor((now - due) / (24 * 60 * 60 * 1000)));
    // perfect if not overdue; degrade by 5 points per day overdue, floor at 0 for this settlement.
    const p = clamp100(100 - overdueDays * 5);
    points += p;
  }
  return clamp100(points / Math.min(12, relevant.length));
}

export function computeShrinkageScore(input: { movements: ConsignmentMovementRow[] }): { score: number; shrinkageRate: number } {
  let issued = 0;
  let missing = 0;
  let damaged = 0;
  for (const m of input.movements) {
    if (m.movementStatus !== "posted") continue;
    const pid = (m.metadata as any)?.product_id;
    if (!pid) continue;
    if (m.movementType === "issue") issued += Math.max(0, num(m.qtyDelta));
    if (m.movementType === "missing") missing += Math.abs(num(m.qtyDelta));
    if (m.movementType === "damage") damaged += Math.abs(num(m.qtyDelta));
  }
  if (issued <= 0) return { score: 75, shrinkageRate: 0 };
  const shrink = clamp01((missing + damaged) / issued);
  // 0% shrink => 100, 10% => 50, 20% => 0
  const score = clamp100(100 - shrink * 500);
  return { score, shrinkageRate: round2(shrink) };
}

export function computePricingDisciplineScore(input: { riskFlags: ConsignmentRiskFlagRow[] }): number {
  const open = input.riskFlags.filter((f) => f.status === "open");
  const violations = open.filter((f) => f.flagCode === "CONSIGNMENT_SOLD_BELOW_MIN_PRICE");
  if (violations.length === 0) return 95;
  // Each open violation reduces score by 15, floor 0
  return clamp100(95 - violations.length * 15);
}

export function computeDisputeFrequencyScore(input: { disputeEvents: Array<{ at: string }>; windowDays: number }): number {
  const count = input.disputeEvents.length;
  if (count === 0) return 95;
  // Simple: 1 dispute => 80, 2 => 65, 3 => 50, 4 => 35, 5+ => 20
  return clamp100(95 - count * 15);
}

export function computeStockAgingScore(input: { aging: ReturnType<typeof computeStockAging> }): number {
  const dead = input.aging.deadStockQty;
  if (dead <= 0) return 90;
  // Penalize dead stock quantity weight; capped
  return clamp100(90 - Math.min(70, dead / 10));
}

export function computeReliabilityTrustScore(input: {
  settlementDisciplineScore: number;
  shrinkageScore: number;
  pricingDisciplineScore: number;
  disputeFrequencyScore: number;
}): number {
  // Weighted blend (explainable)
  return clamp100(
    input.settlementDisciplineScore * 0.35 +
      input.shrinkageScore * 0.35 +
      input.pricingDisciplineScore * 0.2 +
      input.disputeFrequencyScore * 0.1,
  );
}

export function bandFromScore(score: number): ScoreBand {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 55) return "watch";
  if (score >= 35) return "risky";
  return "blocked";
}

export function computeAgentConsignmentScores(input: ConsignmentAgentIntelligenceInput): { scores: ConsignmentAgentScores; aging: StockAgingLine[]; recommendations: Recommendation[] } {
  const aging = computeStockAging({ nowIso: input.nowIso, movements: input.movements, deadStockDays: 45 });
  const sellThroughRate = computeSellThroughRate({ movements: input.movements });
  const salesVelocityScore = clamp100(sellThroughRate * 100);
  const settlementDisciplineScore = computeSettlementTimelinessScore({
    settlements: input.settlements,
    graceDays: input.agreement.settlementGraceDays,
    nowIso: input.nowIso,
  });
  const shrink = computeShrinkageScore({ movements: input.movements });
  const pricingDisciplineScore = computePricingDisciplineScore({ riskFlags: input.riskFlags });
  const disputeFrequencyScore = computeDisputeFrequencyScore({ disputeEvents: input.disputeEvents, windowDays: 45 });
  const stockAgingScore = computeStockAgingScore({ aging });
  const reliabilityScore = computeReliabilityTrustScore({
    settlementDisciplineScore,
    shrinkageScore: shrink.score,
    pricingDisciplineScore,
    disputeFrequencyScore,
  });

  // Overall score: balanced across sales performance + trust + aging
  const score = clamp100(reliabilityScore * 0.55 + salesVelocityScore * 0.25 + stockAgingScore * 0.2);
  const band = bandFromScore(score);

  const recommendations: Recommendation[] = [];

  if (band === "blocked" || reliabilityScore < 35) {
    recommendations.push({
      code: "stop_issuing_new_stock",
      severity: "critical",
      title: "Stop issuing new stock to this agent",
      rationale: "Trust score is critically low due to settlement/shrinkage/pricing/dispute signals.",
      evidence: { reliabilityScore, settlementDisciplineScore, shrinkageScore: shrink.score, pricingDisciplineScore, disputeFrequencyScore },
    });
  }

  if (shrink.shrinkageRate >= 0.08) {
    recommendations.push({
      code: "recall_stock",
      severity: shrink.shrinkageRate >= 0.15 ? "critical" : "urgent",
      title: "Recall consignment stock",
      rationale: "Shrinkage rate indicates custody risk; reduce exposure and perform audit/reconciliation.",
      evidence: { shrinkageRate: shrink.shrinkageRate, shrinkageScore: shrink.score },
    });
  }

  if (aging.deadStockQty >= 20) {
    recommendations.push({
      code: "redistribute_to_stronger_agent",
      severity: "urgent",
      title: "Redistribute dead/slow stock to stronger agent",
      rationale: "Dead-stock is accumulating; move inventory to a higher-velocity channel to protect principal cashflow.",
      evidence: { deadStockQty: aging.deadStockQty, deadStockCount: aging.deadStockCount, sellThroughRate },
    });
    recommendations.push({
      code: "discount_strategically",
      severity: "warning",
      title: "Discount strategically to clear aging stock",
      rationale: "Use controlled discounts (within agreement rules) to improve sell-through on aging inventory.",
      evidence: { deadStockQty: aging.deadStockQty, pricingDisciplineScore },
    });
    recommendations.push({
      code: "bundle_stock",
      severity: "warning",
      title: "Bundle slow-moving items",
      rationale: "Bundles can lift sell-through without deep discounts, especially where minimum prices constrain discounts.",
      evidence: { deadStockCount: aging.deadStockCount, sellThroughRate },
    });
  }

  return {
    scores: {
      score,
      band,
      reliabilityScore,
      salesVelocityScore,
      shrinkageRiskScore: shrink.score,
      settlementDisciplineScore,
      pricingDisciplineScore,
      disputeFrequencyScore,
      stockAgingScore,
      sellThroughRate,
      deadStockCount: aging.deadStockCount,
      deadStockQty: aging.deadStockQty,
      metrics: {
        sellThroughRate,
        shrinkageRate: shrink.shrinkageRate,
        deadStockLines: aging.lines.slice(0, 50),
      },
    },
    aging: aging.lines,
    recommendations,
  };
}

