import type { IdeliverExternalProvider, IdeliverFareBand } from "@/modules/dashboard/settings/ideliver/ideliver-types";
import { computeCartSaleTax } from "@/modules/financial/lib/pos-sale-tax";
import type { Cart } from "../types/pos";

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Tiered radius pricing: first band where distanceKm ≤ maxRadiusKm wins; otherwise highest tier fee.
 */
export function computeFareFromBands(bands: IdeliverFareBand[], distanceKm: number): number {
  if (!bands.length) return 0;
  const d = Math.max(0, distanceKm);
  const sorted = [...bands].sort((a, b) => a.maxRadiusKm - b.maxRadiusKm);
  for (const b of sorted) {
    if (d <= b.maxRadiusKm) return roundMoney(b.fee);
  }
  return roundMoney(sorted[sorted.length - 1]!.fee);
}

export function computeCartDeliveryFee(cart: Cart, providers: IdeliverExternalProvider[]): number {
  if (!cart.delivery.enabled || !cart.delivery.providerId) return 0;
  const p = providers.find((x) => x.id === cart.delivery.providerId);
  if (!p) return 0;
  if (cart.delivery.overrideEnabled) {
    return roundMoney(Math.max(0, cart.delivery.overrideAmount));
  }
  const dist = Math.max(0, cart.delivery.distanceKm);
  return computeFareFromBands(p.fareBands, dist);
}

export function cartAmountDue(cart: Cart, providers: IdeliverExternalProvider[]): number {
  return computeCartSaleTax(cart, providers).amountDue;
}
