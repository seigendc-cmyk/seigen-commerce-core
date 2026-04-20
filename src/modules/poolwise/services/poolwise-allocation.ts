import type { Pool, PoolMember, SupplierOffer } from "@/modules/poolwise/services/poolwise-store";
import { chooseBestUnitPrice, contributedTotalByTenant } from "@/modules/poolwise/services/poolwise-store";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type PoolWiseAllocationSuggestion = {
  tenantId: string;
  tenantName: string;
  orderedQty: number;
  allocatedQty: number;
  unitPrice: number;
  allocatedValue: number;
  reason: string;
};

/**
 * Allocation engine for PoolWise.
 *
 * - by_contribution: allocate value proportionally to contributions; convert to qty using best price break.
 * - by_ordered_qty: allocate exactly ordered qty (admin can adjust separately).
 * - admin_override: returns empty suggestions (UI expects manual entry).
 */
export function suggestAllocations(input: {
  pool: Pool;
  members: PoolMember[];
  offer: SupplierOffer;
  totalQty: number;
}): PoolWiseAllocationSuggestion[] {
  const totalQty = Math.max(0, Math.floor(Number(input.totalQty) || 0));
  const active = input.members.filter((m) => m.status !== "dropped");
  if (totalQty <= 0 || active.length === 0) return [];

  if (input.pool.allocationMode === "admin_override") return [];

  const unitPrice = chooseBestUnitPrice(input.offer, totalQty);

  if (input.pool.allocationMode === "by_ordered_qty") {
    // If ordered qty is not yet captured, split equally.
    const hasPledges = active.some((m) => (m.pledgedAmount ?? 0) > 0);
    const per = hasPledges ? 0 : Math.floor(totalQty / active.length);
    let remaining = totalQty;
    return active.map((m, i) => {
      const ordered = hasPledges ? Math.max(0, Math.floor((m.pledgedAmount ?? 0) / Math.max(unitPrice, 0.0001))) : per + (i === 0 ? totalQty - per * active.length : 0);
      const alloc = Math.min(remaining, ordered);
      remaining -= alloc;
      return {
        tenantId: m.tenantId,
        tenantName: m.tenantName,
        orderedQty: ordered,
        allocatedQty: alloc,
        unitPrice,
        allocatedValue: round2(alloc * unitPrice),
        reason: "Ordered quantity allocation",
      };
    });
  }

  // by_contribution
  const contrib = contributedTotalByTenant(input.pool.id);
  let totalContrib = 0;
  for (const m of active) totalContrib += Math.max(0, contrib.get(m.tenantId) ?? 0);
  if (totalContrib <= 1e-9) {
    // fallback equal
    const per = Math.floor(totalQty / active.length);
    let remaining = totalQty;
    return active.map((m, i) => {
      const alloc = Math.min(remaining, per + (i === 0 ? totalQty - per * active.length : 0));
      remaining -= alloc;
      return {
        tenantId: m.tenantId,
        tenantName: m.tenantName,
        orderedQty: alloc,
        allocatedQty: alloc,
        unitPrice,
        allocatedValue: round2(alloc * unitPrice),
        reason: "Equal split (no contributions recorded)",
      };
    });
  }

  // Allocate value share → qty; then reconcile rounding leftover.
  const provisional = active.map((m) => {
    const c = Math.max(0, contrib.get(m.tenantId) ?? 0);
    const share = c / totalContrib;
    const qty = Math.floor(totalQty * share);
    return { m, c, qty };
  });
  let used = provisional.reduce((s, x) => s + x.qty, 0);
  let leftover = totalQty - used;
  provisional.sort((a, b) => b.c - a.c);
  for (let i = 0; i < provisional.length && leftover > 0; i++) {
    provisional[i] = { ...provisional[i], qty: provisional[i].qty + 1 };
    leftover--;
  }

  return provisional.map((x) => ({
    tenantId: x.m.tenantId,
    tenantName: x.m.tenantName,
    orderedQty: x.qty,
    allocatedQty: x.qty,
    unitPrice,
    allocatedValue: round2(x.qty * unitPrice),
    reason: "Proportional to contributions",
  }));
}

