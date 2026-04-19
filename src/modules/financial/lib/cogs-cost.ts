import type { Product } from "@/modules/inventory/types/models";
import type { ProductReadModel } from "@/modules/inventory/types/product-read-model";

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Unit cost basis for COGS (average cost preferred, else unit cost). */
export function landUnitCostFromProduct(p: Product): number {
  const a = p.averageCost;
  const c = p.costPrice;
  const v = typeof a === "number" && Number.isFinite(a) && a >= 0 ? a : c;
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? roundMoney(v) : 0;
}

export function landUnitCostFromReadModel(p: ProductReadModel): number {
  const a = p.averageCost;
  const c = p.costPrice;
  const v = typeof a === "number" && Number.isFinite(a) && a >= 0 ? a : c;
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? roundMoney(v) : 0;
}
