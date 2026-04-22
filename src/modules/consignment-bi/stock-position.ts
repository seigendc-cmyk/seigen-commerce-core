import type { ConsignmentMovementRow, ConsignmentMovementType } from "./types";

export type ConsignmentCustodyStockPositionLine = {
  productId: string;
  issuedQty: number;
  receivedQty: number;
  soldQty: number;
  returnedQty: number;
  damagedQty: number;
  missingQty: number;
  adjustedQty: number;
  /**
   * Current custody on-hand (agent/stall) computed from movement ledger.
   * Sign convention: issue/adjust increases custody, sell/return/damage/missing reduces.
   * Receive/reconciliation are informational and do not change on-hand.
   */
  onHandQty: number;
  /**
   * Value basis (not authoritative accounting). Uses movement.amountValue when present, otherwise qty * unitCost.
   */
  onHandValue: number;
};

export type ConsignmentCustodyStockPosition = {
  consignmentId: string;
  asOfAt: string;
  lines: ConsignmentCustodyStockPositionLine[];
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function movementValue(m: ConsignmentMovementRow): number {
  if (m.amountValue != null && Number.isFinite(m.amountValue)) return Number(m.amountValue);
  const qty = Number(m.qtyDelta ?? 0);
  const unit = m.unitCost == null ? 0 : Number(m.unitCost);
  if (!Number.isFinite(qty) || !Number.isFinite(unit)) return 0;
  return round2(qty * unit);
}

function bucketForType(t: ConsignmentMovementType):
  | "issue"
  | "receive"
  | "sell"
  | "return"
  | "damage"
  | "missing"
  | "adjust"
  | "reconciliation"
  | "settlement" {
  return t;
}

/**
 * Compute custody stock position from the immutable movement ledger.
 * - Only `posted` movements should be fed here (service layer enforces this).
 * - `receive` and `reconciliation` do not change on-hand; they capture confirmation/snapshots.
 */
export function computeConsignmentCustodyStockPosition(input: {
  consignmentId: string;
  asOfAt?: string;
  movements: Array<Pick<ConsignmentMovementRow, "movementType" | "qtyDelta" | "unitCost" | "amountValue" | "metadata" | "at">>;
}): ConsignmentCustodyStockPosition {
  const asOfAt = input.asOfAt ?? new Date().toISOString();
  const byProduct = new Map<string, ConsignmentCustodyStockPositionLine>();

  for (const m of input.movements) {
    const meta: any = (m.metadata as any) ?? {};
    const productId: string | null = meta.product_id == null ? null : String(meta.product_id);
    if (!productId) continue;

    if (!byProduct.has(productId)) {
      byProduct.set(productId, {
        productId,
        issuedQty: 0,
        receivedQty: 0,
        soldQty: 0,
        returnedQty: 0,
        damagedQty: 0,
        missingQty: 0,
        adjustedQty: 0,
        onHandQty: 0,
        onHandValue: 0,
      });
    }
    const line = byProduct.get(productId)!;

    const type = bucketForType(m.movementType as any);
    const qty = round2(Number(m.qtyDelta ?? 0));
    const val = movementValue(m as any);

    switch (type) {
      case "issue": {
        const q = Math.max(0, qty);
        line.issuedQty = round2(line.issuedQty + q);
        line.onHandQty = round2(line.onHandQty + q);
        line.onHandValue = round2(line.onHandValue + Math.abs(val));
        break;
      }
      case "adjust": {
        // Adjust can be positive (surplus found) or negative (correction). We track absolute separately.
        line.adjustedQty = round2(line.adjustedQty + qty);
        line.onHandQty = round2(line.onHandQty + qty);
        line.onHandValue = round2(line.onHandValue + val);
        break;
      }
      case "sell": {
        const q = Math.abs(qty);
        line.soldQty = round2(line.soldQty + q);
        line.onHandQty = round2(line.onHandQty - q);
        line.onHandValue = round2(line.onHandValue - Math.abs(val));
        break;
      }
      case "return": {
        const q = Math.abs(qty);
        line.returnedQty = round2(line.returnedQty + q);
        line.onHandQty = round2(line.onHandQty - q);
        line.onHandValue = round2(line.onHandValue - Math.abs(val));
        break;
      }
      case "damage": {
        const q = Math.abs(qty);
        line.damagedQty = round2(line.damagedQty + q);
        line.onHandQty = round2(line.onHandQty - q);
        line.onHandValue = round2(line.onHandValue - Math.abs(val));
        break;
      }
      case "missing": {
        const q = Math.abs(qty);
        line.missingQty = round2(line.missingQty + q);
        line.onHandQty = round2(line.onHandQty - q);
        line.onHandValue = round2(line.onHandValue - Math.abs(val));
        break;
      }
      case "receive": {
        const q = Math.max(0, Number(meta.qty_received ?? 0));
        if (Number.isFinite(q) && q > 0) line.receivedQty = round2(line.receivedQty + q);
        break;
      }
      case "reconciliation":
      case "settlement": {
        // informational in custody stock position calculation
        break;
      }
      default:
        break;
    }
  }

  return {
    consignmentId: input.consignmentId,
    asOfAt,
    lines: Array.from(byProduct.values()).sort((a, b) => a.productId.localeCompare(b.productId)),
  };
}

