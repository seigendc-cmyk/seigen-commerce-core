import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";
import { listSales } from "@/modules/pos/services/sales-service";
import type { Id } from "@/modules/inventory/types/models";

export type PoolWiseSignalKind = "low_stock" | "fast_seller" | "dead_stock";

export type PoolWiseSignal = {
  id: string;
  kind: PoolWiseSignalKind;
  productId: Id;
  sku: string;
  name: string;
  branchId: Id;
  branchName: string;
  onHand: number;
  reorderQty: number;
  /** Units sold over lookback window. */
  unitsSold: number;
  /** Approximate daily velocity. */
  unitsPerDay: number;
  createdAt: string;
  message: string;
  confidence: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function branchName(id: Id): string {
  return InventoryRepo.getBranch(id)?.name?.trim() || id;
}

export function buildPoolWiseSignals(input?: {
  /** Days of sales history to scan. Default 30. */
  lookbackDays?: number;
  /** Only generate low-stock when onHand <= reorderQty. Default true. */
  includeLowStock?: boolean;
  /** Fast sellers threshold units/day. Default 1.0. */
  fastSellerUnitsPerDay?: number;
  /** Dead stock threshold: onHand>0 and unitsSold==0 in lookback. Default true. */
  includeDeadStock?: boolean;
}): PoolWiseSignal[] {
  const lookbackDays = Math.max(1, Math.floor(input?.lookbackDays ?? 30));
  const includeLowStock = input?.includeLowStock ?? true;
  const includeDeadStock = input?.includeDeadStock ?? true;
  const fastSellerUnitsPerDay = Math.max(0, Number(input?.fastSellerUnitsPerDay ?? 1));

  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - lookbackDays);
  const startIso = start.toISOString();

  const branch = InventoryRepo.getDefaultTradingBranch() ?? InventoryRepo.getDefaultBranch();
  const products = InventoryRepo.listProducts();

  // sales qty per product in lookback (default branch sales only, since sale.branchId is used by stock).
  const soldByProductId = new Map<string, number>();
  for (const s of listSales()) {
    if (s.status !== "completed") continue;
    if (s.branchId !== branch.id) continue;
    if (s.createdAt < startIso) continue;
    for (const l of s.lines) {
      soldByProductId.set(l.productId, (soldByProductId.get(l.productId) ?? 0) + l.qty);
    }
  }

  const signals: PoolWiseSignal[] = [];
  const ts = new Date().toISOString();

  for (const p of products) {
    const onHand = InventoryRepo.getStock(branch.id, p.id)?.onHandQty ?? 0;
    const reorder = Math.max(0, Math.floor(Number(p.reorderQty ?? 0) || 0));
    const unitsSold = soldByProductId.get(p.id) ?? 0;
    const perDay = round2(unitsSold / lookbackDays);

    if (includeLowStock && reorder > 0 && onHand <= reorder) {
      const confidence = Math.min(1, 0.6 + Math.min(0.4, perDay / 5));
      signals.push({
        id: uid("sig"),
        kind: "low_stock",
        productId: p.id,
        sku: p.sku,
        name: p.name,
        branchId: branch.id,
        branchName: branchName(branch.id),
        onHand,
        reorderQty: reorder,
        unitsSold,
        unitsPerDay: perDay,
        createdAt: ts,
        message: `${p.sku} low stock: on hand ${onHand} vs reorder ${reorder}`,
        confidence,
      });
    }

    if (fastSellerUnitsPerDay > 0 && perDay >= fastSellerUnitsPerDay) {
      const confidence = Math.min(1, 0.5 + Math.min(0.5, perDay / (fastSellerUnitsPerDay * 2)));
      signals.push({
        id: uid("sig"),
        kind: "fast_seller",
        productId: p.id,
        sku: p.sku,
        name: p.name,
        branchId: branch.id,
        branchName: branchName(branch.id),
        onHand,
        reorderQty: reorder,
        unitsSold,
        unitsPerDay: perDay,
        createdAt: ts,
        message: `${p.sku} fast seller: ${perDay}/day (${unitsSold} in ${lookbackDays}d)`,
        confidence,
      });
    }

    if (includeDeadStock && onHand > 0 && unitsSold <= 0) {
      signals.push({
        id: uid("sig"),
        kind: "dead_stock",
        productId: p.id,
        sku: p.sku,
        name: p.name,
        branchId: branch.id,
        branchName: branchName(branch.id),
        onHand,
        reorderQty: reorder,
        unitsSold,
        unitsPerDay: perDay,
        createdAt: ts,
        message: `${p.sku} dead stock: ${onHand} on hand, no sales in ${lookbackDays} days`,
        confidence: 0.7,
      });
    }
  }

  // Sort high-signal first.
  const kindRank: Record<PoolWiseSignalKind, number> = { low_stock: 0, fast_seller: 1, dead_stock: 2 };
  signals.sort((a, b) => kindRank[a.kind] - kindRank[b.kind] || b.confidence - a.confidence || a.sku.localeCompare(b.sku));
  return signals.slice(0, 120);
}

