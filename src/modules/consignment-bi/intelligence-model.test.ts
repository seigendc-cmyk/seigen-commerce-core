import { describe, expect, it } from "vitest";
import type { ConsignmentAgreementRow, ConsignmentMovementRow, ConsignmentRiskFlagRow, ConsignmentSettlementRow } from "./types";
import { computeAgentConsignmentScores } from "./intelligence-model";

function ag(patch: Partial<ConsignmentAgreementRow> = {}): ConsignmentAgreementRow {
  const now = new Date().toISOString();
  return {
    id: "ag1",
    tenantId: "t1",
    agreementCode: "A-001",
    status: "active",
    principalVendorName: "Principal",
    agentId: "agent1",
    agentName: "Agent",
    stallBranchId: "b1",
    stallLabel: "Stall",
    commissionModel: "percent_of_sale",
    commissionPercent: 10,
    commissionFixedPerUnit: null,
    commissionTiersJson: [],
    minimumPriceRule: "none",
    minimumPrice: null,
    minimumMarginPercent: null,
    settlementCycle: "weekly",
    settlementDayOfWeek: null,
    settlementDayOfMonth: null,
    settlementGraceDays: 2,
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    expiryDate: null,
    allowDiscounts: true,
    maxDiscountPercent: null,
    allowPriceOverride: true,
    allowReturns: true,
    allowPartialSettlement: true,
    notes: "",
    metadata: {},
    createdAt: now,
    updatedAt: now,
    ...patch,
  };
}

function mv(partial: Partial<ConsignmentMovementRow> & { movementType: any; qtyDelta: number; at: string; productId?: string }) {
  return {
    id: "m1",
    tenantId: "t1",
    consignmentId: "c1",
    consignmentItemId: null,
    movementType: partial.movementType,
    movementStatus: "posted",
    at: partial.at,
    actorUserId: null,
    actorLabel: "user",
    fromCustodyScopeType: null,
    fromCustodyScopeId: null,
    toCustodyScopeType: null,
    toCustodyScopeId: null,
    qtyDelta: partial.qtyDelta,
    unitCost: partial.unitCost ?? null,
    unitPrice: partial.unitPrice ?? null,
    amountValue: partial.amountValue ?? null,
    currencyCode: "USD",
    referenceCode: null,
    sourceDocumentId: null,
    relatedSaleId: null,
    narration: "",
    metadata: { product_id: partial.productId ?? "p1" },
    createdAt: partial.at,
  } as ConsignmentMovementRow;
}

function st(partial: Partial<ConsignmentSettlementRow> & { periodTo: string; status: any }) {
  const now = new Date().toISOString();
  return {
    id: "s1",
    tenantId: "t1",
    agreementId: "ag1",
    consignmentId: null,
    settlementCode: "CSET-001",
    periodFrom: "2026-01-01",
    periodTo: partial.periodTo,
    status: partial.status,
    grossSalesValue: 0,
    commissionValue: 0,
    netDueToPrincipal: 0,
    netDueToAgent: 0,
    currencyCode: "USD",
    notes: "",
    createdAt: now,
    updatedAt: now,
  } as ConsignmentSettlementRow;
}

describe("consignment intelligence model", () => {
  it("recommends stop issuing when reliability is critically low", () => {
    const nowIso = "2026-02-15T00:00:00.000Z";
    const movements: ConsignmentMovementRow[] = [
      mv({ movementType: "issue", qtyDelta: 100, at: "2026-01-01T00:00:00.000Z" }),
      mv({ movementType: "missing", qtyDelta: -20, at: "2026-01-10T00:00:00.000Z" }),
      mv({ movementType: "damage", qtyDelta: -10, at: "2026-01-12T00:00:00.000Z" }),
    ];
    const riskFlags: ConsignmentRiskFlagRow[] = [
      {
        id: "rf1",
        tenantId: "t1",
        agreementId: "ag1",
        consignmentId: null,
        agentId: "agent1",
        stallBranchId: "b1",
        flagCode: "CONSIGNMENT_SOLD_BELOW_MIN_PRICE",
        severity: "high",
        status: "open",
        title: "Price violation",
        summary: "",
        evidenceJson: {},
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ];
    const settlements: ConsignmentSettlementRow[] = [st({ periodTo: "2026-01-10", status: "submitted" })];

    const r = computeAgentConsignmentScores({
      nowIso,
      agreement: ag(),
      movements,
      settlements,
      riskFlags,
      disputeEvents: [],
    });
    expect(r.scores.reliabilityScore).toBeLessThan(60);
    expect(r.recommendations.some((x) => x.code === "stop_issuing_new_stock")).toBe(true);
  });
});

