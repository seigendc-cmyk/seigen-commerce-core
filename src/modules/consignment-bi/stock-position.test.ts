import { describe, expect, it } from "vitest";
import { computeConsignmentCustodyStockPosition } from "./stock-position";

describe("consignment-bi stock position", () => {
  it("computes on-hand across issue → sell → return → damage → missing", () => {
    const pos = computeConsignmentCustodyStockPosition({
      consignmentId: "c1",
      movements: [
        { movementType: "issue", qtyDelta: 10, unitCost: 5, amountValue: 50, metadata: { product_id: "p1" }, at: "2026-01-01" },
        { movementType: "sell", qtyDelta: -2, unitCost: 5, amountValue: 10, metadata: { product_id: "p1" }, at: "2026-01-02" },
        { movementType: "return", qtyDelta: -1, unitCost: 5, amountValue: 5, metadata: { product_id: "p1" }, at: "2026-01-03" },
        { movementType: "damage", qtyDelta: -1, unitCost: 5, amountValue: 5, metadata: { product_id: "p1" }, at: "2026-01-04" },
        { movementType: "missing", qtyDelta: -1, unitCost: 5, amountValue: 5, metadata: { product_id: "p1" }, at: "2026-01-05" },
      ],
    });

    const line = pos.lines.find((l) => l.productId === "p1");
    expect(line?.issuedQty).toBe(10);
    expect(line?.soldQty).toBe(2);
    expect(line?.returnedQty).toBe(1);
    expect(line?.damagedQty).toBe(1);
    expect(line?.missingQty).toBe(1);
    expect(line?.onHandQty).toBe(5);
  });

  it("does not change on-hand for receive/reconciliation", () => {
    const pos = computeConsignmentCustodyStockPosition({
      consignmentId: "c1",
      movements: [
        { movementType: "issue", qtyDelta: 10, unitCost: 5, amountValue: 50, metadata: { product_id: "p1" }, at: "2026-01-01" },
        { movementType: "receive", qtyDelta: 0, unitCost: null, amountValue: null, metadata: { product_id: "p1", qty_received: 10 }, at: "2026-01-02" },
        { movementType: "reconciliation", qtyDelta: 0, unitCost: null, amountValue: null, metadata: { product_id: "p1", expected_qty: 10, physical_count_qty: 10 }, at: "2026-01-03" },
      ],
    });

    const line = pos.lines.find((l) => l.productId === "p1");
    expect(line?.issuedQty).toBe(10);
    expect(line?.receivedQty).toBe(10);
    expect(line?.onHandQty).toBe(10);
  });
});

