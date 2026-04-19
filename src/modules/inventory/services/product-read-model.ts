import { getSectorConfig } from "../sector-config/sectors";
import type { InventoryItemType } from "../types/inventory-product-meta";
import type { Id, Product } from "../types/models";
import type { ProductReadModel } from "../types/product-read-model";
import { InventoryRepo } from "./inventory-repo";

function sectorLabel(sectorId: string): string {
  return getSectorConfig(sectorId)?.label ?? sectorId;
}

/** Flatten sector JSON bag for token search (agriculture sale leads, spare part numbers, etc.). */
export function flattenSectorDataForSearch(sd: Record<string, unknown> | undefined): string {
  if (!sd || typeof sd !== "object") return "";
  const parts: string[] = [];
  for (const v of Object.values(sd)) {
    if (v == null || v === "") continue;
    if (typeof v === "boolean") parts.push(v ? "yes" : "no");
    else if (typeof v === "number") parts.push(String(v));
    else if (typeof v === "string") parts.push(v);
    else parts.push(JSON.stringify(v));
  }
  return parts.join(" ").toLowerCase();
}

/** Concatenates all product table + sector fields for catalog / POS search tokens. */
export function buildCatalogSearchText(p: Product, sectorSearch: string): string {
  const sup = p.supplierId ? (InventoryRepo.getSupplier(p.supplierId)?.name ?? "") : "";
  const alt = p.alternativeProductId ? InventoryRepo.getProduct(p.alternativeProductId) : undefined;
  const altTxt = alt ? `${alt.sku} ${alt.name}` : "";
  const bp = p.branchPrices && Object.keys(p.branchPrices).length > 0 ? JSON.stringify(p.branchPrices) : "";
  const inv = (p.inventoryType ?? "inventory") as InventoryItemType;
  const bomTxt = p.bom
    ? [
        ...(p.bom.assemblyInputs ?? []).flatMap((l) => {
          const c = InventoryRepo.getProduct(l.productId);
          return [l.label, l.productId, c?.sku, c?.name].filter(Boolean);
        }),
        ...(p.bom.disassemblyOutputs ?? []).flatMap((l) => {
          const c = InventoryRepo.getProduct(l.productId);
          return [l.label, l.productId, c?.sku, c?.name].filter(Boolean);
        }),
      ].join(" ")
    : "";
  const parts = [
    p.name,
    p.sku,
    p.description,
    p.productNotes,
    p.brand,
    p.upc,
    p.barcode,
    p.locDepartment,
    p.locShelf,
    p.locSite,
    inv,
    p.supplierId,
    sup,
    p.alternativeProductId,
    altTxt,
    String(p.sellingPrice),
    String(p.costPrice),
    String(p.averageCost ?? p.costPrice),
    bp,
    p.taxable === false ? "tax exempt nontaxable" : "taxable",
    String(p.reorderQty ?? 0),
    bomTxt,
    sectorSearch,
    JSON.stringify(p.sectorData ?? {}),
  ];
  return parts.filter((x) => x !== undefined && x !== null && String(x).trim() !== "").join(" ").toLowerCase();
}

/**
 * On-hand quantity for one product at a branch from local `StockRecord` rows.
 * If no record exists, quantity is 0.
 */
export function getOnHandForProduct(branchId: Id, productId: Id): number {
  return InventoryRepo.getStock(branchId, productId)?.onHandQty ?? 0;
}

/** Sum on-hand for this SKU at the branch (all product IDs sharing the same trimmed SKU). */
export function getOnHandSumForSkuAtBranch(branchId: Id, sku: string): number {
  const key = sku.trim().toLowerCase();
  if (!key) return 0;
  let sum = 0;
  for (const p of InventoryRepo.listProducts()) {
    if (p.sku.trim().toLowerCase() === key) {
      sum += getOnHandForProduct(branchId, p.id);
    }
  }
  return sum;
}

function toRead(p: Product, branchId: Id, onHandQty?: number): ProductReadModel {
  const images = (p.images ?? []).slice().sort((a, b) => a.order - b.order);
  const sectorSearch = flattenSectorDataForSearch(p.sectorData as Record<string, unknown>);
  const inv = (p.inventoryType ?? "inventory") as InventoryItemType;
  const scan = p.upc ?? p.barcode;
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    sectorId: p.sectorId,
    sectorLabel: sectorLabel(p.sectorId),
    inventoryType: inv,
    locDepartment: p.locDepartment,
    locShelf: p.locShelf,
    locSite: p.locSite,
    costPrice: p.costPrice,
    averageCost: typeof p.averageCost === "number" && Number.isFinite(p.averageCost) ? p.averageCost : p.costPrice,
    sellingPrice: p.sellingPrice,
    onHandQty: onHandQty ?? getOnHandForProduct(branchId, p.id),
    branchId,
    active: p.active,
    forSale: p.forSale !== false,
    unit: p.unit,
    barcode: p.barcode,
    upc: scan,
    brand: p.brand,
    description: p.description,
    productNotes: p.productNotes,
    taxable: p.taxable !== false,
    supplierId: p.supplierId,
    reorderQty: Math.max(0, Math.floor(Number.isFinite(p.reorderQty) ? Number(p.reorderQty) : 0)),
    alternativeProductId: p.alternativeProductId,
    primaryImage: images[0],
    images,
    sectorSearchText: sectorSearch,
    catalogSearchText: buildCatalogSearchText(p, sectorSearch),
    flagExternalIdeliver: Boolean(p.flagExternalIdeliver),
  };
}

function skuDedupeKey(sku: string): string {
  return sku.trim().toLowerCase();
}

export function getProductReadModel(productId: Id, branchId?: Id): ProductReadModel | undefined {
  const branch = branchId ? InventoryRepo.getBranch(branchId) : InventoryRepo.getDefaultBranch();
  if (!branch) return undefined;
  const p = InventoryRepo.getProduct(productId);
  if (!p) return undefined;
  return toRead(p, branch.id);
}

/**
 * All products for the given branch (default when omitted), one row per SKU.
 * Duplicate SKU rows in local storage (legacy/double-submit) are collapsed: canonical row is the
 * most recently updated product, and on-hand is summed across all matching IDs for that branch.
 */
export function listProductReadModels(branchId?: Id): ProductReadModel[] {
  const branch = branchId ? InventoryRepo.getBranch(branchId) : InventoryRepo.getDefaultBranch();
  if (!branch) return [];
  const products = InventoryRepo.listProducts();
  const groups = new Map<string, Product[]>();
  for (const p of products) {
    const raw = skuDedupeKey(p.sku);
    const k = raw.length > 0 ? raw : p.id;
    const arr = groups.get(k) ?? [];
    arr.push(p);
    groups.set(k, arr);
  }
  const merged: ProductReadModel[] = [];
  for (const group of groups.values()) {
    const canonical = [...group].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]!;
    let onHandSum = 0;
    for (const p of group) {
      onHandSum += getOnHandForProduct(branch.id, p.id);
    }
    merged.push(toRead(canonical, branch.id, onHandSum));
  }
  return merged.sort((a, b) => a.name.localeCompare(b.name));
}
