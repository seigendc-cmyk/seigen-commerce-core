import { describe, expect, it } from "vitest";
import type { ConsignmentAgreementRow } from "./types";
import { attributeConsignmentSale, computeSettlementMismatchRule, settlementOverdueCheck } from "./settlement-calculations";

function mockAgreement(patch: Partial<ConsignmentAgreementRow> = {}): ConsignmentAgreementRow {
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...patch,
  };
}

describe("consignment-bi settlement calculations", () => {
  it("percent commission: principal gets gross - commission", () => {
    const ag = mockAgreement({ commissionModel: "percent_of_sale", commissionPercent: 10 });
    const sale = attributeConsignmentSale({
      agreement: ag,
      movementId: "m1",
      occurredAt: new Date().toISOString(),
      correlationId: "c1",
      currencyCode: "USD",
      lines: [{ productId: "p1", qty: 2, unitCost: 50, unitPrice: 100 }],
    });
    expect(sale.grossSalesValue).toBe(200);
    expect(sale.commissionValue).toBe(20);
    expect(sale.netDueToPrincipal).toBe(180);
    expect(sale.netDueToAgent).toBe(20);
  });

  it("fixed per unit commission: agent earns qty * fixed", () => {
    const ag = mockAgreement({ commissionModel: "fixed_per_unit", commissionFixedPerUnit: 3 });
    const sale = attributeConsignmentSale({
      agreement: ag,
      movementId: "m1",
      occurredAt: new Date().toISOString(),
      correlationId: "c1",
      currencyCode: "USD",
      lines: [{ productId: "p1", qty: 4, unitCost: 10, unitPrice: 20 }],
    });
    expect(sale.grossSalesValue).toBe(80);
    expect(sale.commissionValue).toBe(12);
    expect(sale.netDueToPrincipal).toBe(68);
  });

  it("premium above base: principal gets base cost; agent gets premium", () => {
    const ag = mockAgreement({ metadata: { premium_above_base: true } });
    const sale = attributeConsignmentSale({
      agreement: ag,
      movementId: "m1",
      occurredAt: new Date().toISOString(),
      correlationId: "c1",
      currencyCode: "USD",
      lines: [{ productId: "p1", qty: 2, unitCost: 50, unitPrice: 90 }],
    });
    expect(sale.netDueToPrincipal).toBe(100);
    expect(sale.netDueToAgent).toBe(80);
  });

  it("overdue detection uses grace days", () => {
    const r = settlementOverdueCheck({ periodToIsoDate: "2026-01-01", graceDays: 2, nowIso: "2026-01-05T00:00:00.000Z" });
    expect(r.overdue).toBe(true);
    expect(r.daysOverdue).toBeGreaterThanOrEqual(1);
  });

  it("mismatch rule flags short remittance", () => {
    const r = computeSettlementMismatchRule({ expectedDueToPrincipal: 100, remittedAmount: 90 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.mismatch).toBe("short");
      expect(r.delta).toBe(-10);
    }
  });
});

