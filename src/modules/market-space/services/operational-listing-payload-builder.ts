import type { Id } from "@/modules/inventory/types/models";
import { getProductReadModel } from "@/modules/inventory/services/product-read-model";
import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";
import { readMoneyContextSnapshot } from "@/modules/financial/services/money-context";
import type { PublishMarketListingPayload } from "./market-listing-publish.service";

export type OperationalListingDerivation = {
  stock_signal: NonNullable<PublishMarketListingPayload["stock_signal"]>;
  stock_badge: PublishMarketListingPayload["stock_badge"];
  public_price: number;
  currency_code: string;
  title: string;
  short_description: string | null;
  brand: string | null;
  category_id: string | null;
  category_name: string | null;
  searchable_text: string;
  sku: string | null;
  hero_image_url: string | null;
  image_count: number;
  pickup_supported: boolean;
  delivery_supported: boolean;
};

function slugify(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "listing";
}

function clampPrice(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.max(0, n) * 100) / 100;
}

export function derivePublishableStockSignal(input: {
  onHandQty: number;
  reorderQty: number;
  inventoryType: string;
  active: boolean;
  forSale: boolean;
}): { stock_signal: OperationalListingDerivation["stock_signal"]; stock_badge: string | null } {
  // Non-stocked items (services/fees) still need a stock signal in the current projection model.
  const inv = String(input.inventoryType ?? "").trim().toLowerCase();
  const isStocked = inv === "" || inv === "inventory" || inv === "stocked";

  if (!input.active || !input.forSale) {
    return { stock_signal: "out_of_stock", stock_badge: "not_for_sale" };
  }

  if (!isStocked) {
    return { stock_signal: "in_stock", stock_badge: "service" };
  }

  const onHand = Number.isFinite(input.onHandQty) ? input.onHandQty : 0;
  const reorder = Math.max(0, Math.floor(Number.isFinite(input.reorderQty) ? input.reorderQty : 0));
  if (onHand <= 0) return { stock_signal: "out_of_stock", stock_badge: "out_of_stock" };
  if (reorder > 0 && onHand <= reorder) return { stock_signal: "low_stock", stock_badge: "low_stock" };
  return { stock_signal: "in_stock", stock_badge: null };
}

/**
 * Builds a `PublishMarketListingPayload` by deriving listing truth from operational truth
 * (local-first `ProductReadModel` + branch stock), while keeping projection-only fields as caller-owned.
 *
 * This does NOT publish by itself; it only builds a payload that can be passed to the existing publish pipeline.
 */
export function buildPublishMarketListingPayloadFromOperationalTruth(input: {
  vendor_id: string;
  storefront_id: string;
  branch_id: Id;
  product_id: Id;
  publish_status: PublishMarketListingPayload["publish_status"];

  // Projection-only / operator-entered fields (remain optional here).
  listing_slug?: string;
  compare_at_price?: number | null;
  verification_flag?: boolean;
  trust_score?: number | null;
  visible_in_market_space?: boolean;
  visible_in_itred?: boolean;
  city?: string | null;
  suburb?: string | null;
  province?: string | null;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
  radius_km?: number | null;
  pickup_supported?: boolean;
  delivery_supported?: boolean;
}): { ok: true; payload: PublishMarketListingPayload; derived: OperationalListingDerivation } | { ok: false; error: string } {
  const branch = InventoryRepo.getBranch(input.branch_id);
  if (!branch) return { ok: false, error: "Branch not found." };

  const rm = getProductReadModel(input.product_id, input.branch_id);
  if (!rm) return { ok: false, error: "Product not found." };

  const currency = readMoneyContextSnapshot().currencyCode;
  const publicPrice = clampPrice(rm.sellingPrice);

  const stock = derivePublishableStockSignal({
    onHandQty: rm.onHandQty,
    reorderQty: rm.reorderQty,
    inventoryType: rm.inventoryType,
    active: rm.active,
    forSale: rm.forSale,
  });

  // Local-first images are base64 data URLs, not public URLs. Keep projection clean.
  const image_count = Array.isArray(rm.images) ? rm.images.length : 0;
  const hero_image_url = null;

  const title = rm.name.trim() || rm.sku.trim() || "Item";
  const short = (rm.description?.trim() || "").slice(0, 240);
  const short_description = short ? short : null;

  const listing_slug =
    (input.listing_slug ?? "").trim() ||
    slugify([rm.sku, rm.name].filter(Boolean).join(" ").slice(0, 120));

  const derived: OperationalListingDerivation = {
    stock_signal: stock.stock_signal,
    stock_badge: stock.stock_badge,
    public_price: publicPrice,
    currency_code: currency,
    title,
    short_description,
    brand: rm.brand?.trim() ? rm.brand.trim() : null,
    category_id: rm.sectorId ? String(rm.sectorId) : null,
    category_name: rm.sectorLabel?.trim() ? rm.sectorLabel.trim() : null,
    searchable_text: (rm.catalogSearchText || `${rm.name} ${rm.sku}`).slice(0, 8000),
    sku: rm.sku?.trim() ? rm.sku.trim() : null,
    hero_image_url,
    image_count,
    pickup_supported: input.pickup_supported ?? true,
    delivery_supported: input.delivery_supported ?? Boolean(rm.flagExternalIdeliver),
  };

  const payload: PublishMarketListingPayload = {
    vendor_id: input.vendor_id,
    branch_id: String(input.branch_id),
    storefront_id: input.storefront_id,
    product_id: String(input.product_id),
    sku: derived.sku,
    listing_slug,
    title: derived.title,
    short_description: derived.short_description,
    brand: derived.brand,
    category_id: derived.category_id,
    category_name: derived.category_name,
    searchable_text: derived.searchable_text,
    public_price: derived.public_price,
    compare_at_price: input.compare_at_price ?? null,
    currency_code: derived.currency_code,
    stock_badge: derived.stock_badge,
    stock_signal: derived.stock_signal,
    hero_image_url: derived.hero_image_url,
    image_count: derived.image_count,
    verification_flag: input.verification_flag,
    trust_score: input.trust_score,
    publish_status: input.publish_status,
    city: input.city ?? null,
    suburb: input.suburb ?? null,
    province: input.province ?? null,
    country: input.country ?? null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    radius_km: input.radius_km ?? null,
    pickup_supported: derived.pickup_supported,
    delivery_supported: derived.delivery_supported,
    visible_in_market_space: input.visible_in_market_space,
    visible_in_itred: input.visible_in_itred,
  };

  return { ok: true, payload, derived };
}

