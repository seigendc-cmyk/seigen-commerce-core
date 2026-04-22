import type { SupabaseClient } from "@supabase/supabase-js";
import { emitBrainEventForWorkspace, type EmitBrainEventResult } from "@/modules/brain/brain-actions";
import { BrainEventTypes } from "@/modules/brain/types/brain-event";
import { MarketListingAuditEventTypes } from "@/modules/market-space/constants/market-listing-audit-events";
import type { MarketListingPublishStatus } from "@/modules/market-space/types/publish-status";

export type PublishMarketListingPayload = {
  vendor_id: string;
  branch_id: string;
  storefront_id: string;
  product_id: string;
  sku?: string | null;
  listing_slug: string;
  title: string;
  short_description?: string | null;
  brand?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  searchable_text?: string | null;
  public_price: number;
  compare_at_price?: number | null;
  currency_code?: string;
  stock_badge?: string | null;
  stock_signal?: string | null;
  hero_image_url?: string | null;
  image_count?: number;
  verification_flag?: boolean;
  trust_score?: number | null;
  publish_status: MarketListingPublishStatus;
  city?: string | null;
  suburb?: string | null;
  province?: string | null;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
  radius_km?: number | null;
  pickup_supported?: boolean;
  delivery_supported?: boolean;
  visible_in_market_space?: boolean;
  visible_in_itred?: boolean;
};

export type PublishPipelineResult =
  | { ok: true; listingId: string; brain: EmitBrainEventResult }
  | { ok: false; error: string; validationErrors?: string[] };

const ALLOWED_STOCK_SIGNALS = new Set(["in_stock", "low_stock", "out_of_stock", "preorder", "limited"]);

function normalizeCurrencyCode(raw: unknown): string {
  const s = String(raw ?? "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(s) ? s : s;
}

function normalizeStockSignal(raw: unknown): string | null {
  const s = String(raw ?? "").trim().toLowerCase();
  return s ? s : null;
}

function validatePublishEligibility(row: Record<string, unknown>): string[] {
  const errs: string[] = [];
  if (row.publish_status === "published") {
    if (!String(row.title ?? "").trim()) errs.push("title_required");
    if (!String(row.listing_slug ?? "").trim()) errs.push("listing_slug_required");
    const price = Number(row.public_price);
    if (!Number.isFinite(price) || price <= 0) errs.push("public_price_required");
    const cc = normalizeCurrencyCode(row.currency_code);
    if (!cc) errs.push("currency_code_required");
    else if (!/^[A-Z]{3}$/.test(cc)) errs.push("currency_code_invalid");
    const compare = row.compare_at_price == null ? null : Number(row.compare_at_price);
    if (compare != null && (!Number.isFinite(compare) || compare <= 0)) errs.push("compare_at_price_invalid");
    if (compare != null && Number.isFinite(compare) && compare + 1e-9 < price) errs.push("compare_at_price_lt_public");
    const img = String(row.hero_image_url ?? "").trim();
    const ic = Number(row.image_count ?? 0);
    if (!img && (!Number.isFinite(ic) || ic < 1)) errs.push("approved_media_required");
    if (!String(row.country ?? "").trim()) errs.push("country_required_for_public_geo");
    if (!String(row.city ?? "").trim() && !String(row.province ?? "").trim()) errs.push("geo_minimum_required");
    const lat = row.lat == null ? null : Number(row.lat);
    const lng = row.lng == null ? null : Number(row.lng);
    if ((lat != null || lng != null) && (!Number.isFinite(lat) || !Number.isFinite(lng))) errs.push("geo_lat_lng_invalid");
    const ss = normalizeStockSignal(row.stock_signal);
    if (!ss) errs.push("stock_signal_required");
    else if (!ALLOWED_STOCK_SIGNALS.has(ss)) errs.push("stock_signal_invalid");
    if (row.visible_in_market_space !== true && row.visible_in_itred !== true) {
      errs.push("visibility_required");
    }
  }
  return errs;
}

function rankingFields(input: PublishMarketListingPayload): { freshness_score: number; ranking_score: number } {
  const trust = typeof input.trust_score === "number" && Number.isFinite(input.trust_score) ? input.trust_score : 0;
  const media = (input.image_count ?? 0) > 0 || String(input.hero_image_url ?? "").trim() ? 0.5 : 0;
  const freshness_score = 1;
  const ranking_score = 1 + trust + media;
  return { freshness_score, ranking_score };
}

function buildRow(
  tenantId: string,
  input: PublishMarketListingPayload,
): Record<string, unknown> {
  const { freshness_score, ranking_score } = rankingFields(input);
  const now = new Date().toISOString();
  const published = input.publish_status === "published" ? { published_at: now } : {};
  const currency =
    (input.currency_code ?? "").trim().toUpperCase() ||
    (input.publish_status === "published" ? "" : "USD");
  const stockSignal = normalizeStockSignal(input.stock_signal);
  return {
    tenant_id: tenantId,
    vendor_id: input.vendor_id,
    branch_id: input.branch_id,
    storefront_id: input.storefront_id,
    product_id: input.product_id,
    sku: input.sku ?? null,
    listing_slug: input.listing_slug.trim(),
    title: input.title.trim(),
    short_description: input.short_description ?? null,
    brand: input.brand ?? null,
    category_id: input.category_id ?? null,
    category_name: input.category_name ?? null,
    searchable_text:
      input.searchable_text ??
      [input.title, input.brand, input.category_name, input.sku].filter(Boolean).join(" ").slice(0, 8000),
    public_price: input.public_price,
    compare_at_price: input.compare_at_price ?? null,
    currency_code: currency,
    stock_badge: input.stock_badge ?? null,
    stock_signal: stockSignal,
    hero_image_url: input.hero_image_url ?? null,
    image_count: input.image_count ?? (input.hero_image_url ? 1 : 0),
    verification_flag: input.verification_flag ?? false,
    trust_score: input.trust_score ?? null,
    freshness_score,
    ranking_score,
    publish_status: input.publish_status,
    city: input.city ?? null,
    suburb: input.suburb ?? null,
    province: input.province ?? null,
    country: input.country ?? null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    radius_km: input.radius_km ?? null,
    same_city_priority: false,
    same_suburb_priority: false,
    cross_border_allowed: false,
    pickup_supported: input.pickup_supported ?? false,
    delivery_supported: input.delivery_supported ?? false,
    visible_in_market_space: input.visible_in_market_space ?? input.publish_status === "published",
    visible_in_itred: input.visible_in_itred ?? input.publish_status === "published",
    refreshed_at: now,
    ...published,
  };
}

async function appendListingAudit(supabase: SupabaseClient, row: { tenant_id: string; vendor_id: string; listing_id: string; event_type: string; payload?: Record<string, unknown> }) {
  await supabase.from("market_listing_events").insert({
    tenant_id: row.tenant_id,
    vendor_id: row.vendor_id,
    listing_id: row.listing_id,
    event_type: row.event_type,
    actor_type: "system",
    source_module: "market_space",
    payload: row.payload ?? {},
  });
}

export async function publishMarketListingForWorkspace(
  ctx: { supabase: SupabaseClient; tenantId: string; userId: string },
  input: PublishMarketListingPayload,
  correlationId: string,
): Promise<PublishPipelineResult> {
  const row = buildRow(ctx.tenantId, input);
  const validationErrors = validatePublishEligibility(row);
  if (validationErrors.length > 0) {
    await emitBrainEventForWorkspace({
      eventType: BrainEventTypes.LISTING_PUBLISH_FAILED,
      module: "market_space",
      tenantId: ctx.tenantId,
      branchId: input.branch_id,
      actorId: ctx.userId,
      actorType: "user",
      entityType: "market_listing",
      entityId: input.product_id,
      occurredAt: new Date().toISOString(),
      severity: "warning",
      correlationId,
      payload: { errors: validationErrors, listing_slug: input.listing_slug },
    });
    return { ok: false, error: "Publish validation failed", validationErrors };
  }

  const { data, error } = await ctx.supabase
    .from("public_market_listings")
    .upsert(row, { onConflict: "tenant_id,product_id,branch_id" })
    .select("id")
    .single();

  if (error || !data?.id) {
    return { ok: false, error: error?.message ?? "Upsert failed" };
  }

  const listingId = data.id as string;

  await appendListingAudit(ctx.supabase, {
    tenant_id: ctx.tenantId,
    vendor_id: input.vendor_id,
    listing_id: listingId,
    event_type:
      input.publish_status === "published"
        ? MarketListingAuditEventTypes.LISTING_PUBLISHED
        : MarketListingAuditEventTypes.LISTING_PUBLISH_REQUESTED,
    payload: { listing_slug: input.listing_slug, publish_status: input.publish_status },
  });

  const brain = await emitBrainEventForWorkspace({
    eventType:
      input.publish_status === "published"
        ? BrainEventTypes.LISTING_PUBLISH_SUCCEEDED
        : BrainEventTypes.LISTING_PUBLISH_REQUESTED,
    module: "market_space",
    tenantId: ctx.tenantId,
    branchId: input.branch_id,
    actorId: ctx.userId,
    actorType: "user",
    entityType: "market_listing",
    entityId: listingId,
    occurredAt: new Date().toISOString(),
    severity: "notice",
    correlationId,
    payload: { listing_slug: input.listing_slug, product_id: input.product_id, publish_status: input.publish_status },
  });

  return { ok: true, listingId, brain };
}

export async function unpublishMarketListingForWorkspace(
  ctx: { supabase: SupabaseClient; tenantId: string; userId: string },
  listingId: string,
  reason: string,
  correlationId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: existing, error: readErr } = await ctx.supabase
    .from("public_market_listings")
    .select("id, vendor_id, branch_id, listing_slug, product_id")
    .eq("id", listingId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (readErr || !existing) return { ok: false, error: readErr?.message ?? "Listing not found" };

  const { error } = await ctx.supabase
    .from("public_market_listings")
    .update({
      publish_status: "suspended",
      visible_in_market_space: false,
      visible_in_itred: false,
      refreshed_at: new Date().toISOString(),
    })
    .eq("id", listingId)
    .eq("tenant_id", ctx.tenantId);

  if (error) return { ok: false, error: error.message };

  await appendListingAudit(ctx.supabase, {
    tenant_id: ctx.tenantId,
    vendor_id: existing.vendor_id as string,
    listing_id: listingId,
    event_type: MarketListingAuditEventTypes.LISTING_UNPUBLISHED,
    payload: { reason },
  });

  await emitBrainEventForWorkspace({
    eventType: BrainEventTypes.LISTING_UNPUBLISHED,
    module: "market_space",
    tenantId: ctx.tenantId,
    branchId: (existing.branch_id as string) ?? null,
    actorId: ctx.userId,
    actorType: "user",
    entityType: "market_listing",
    entityId: listingId,
    occurredAt: new Date().toISOString(),
    severity: "notice",
    correlationId,
    payload: { reason, listing_slug: existing.listing_slug },
  });

  return { ok: true };
}

export async function refreshMarketListingProjectionForWorkspace(
  ctx: { supabase: SupabaseClient; tenantId: string; userId: string },
  listingId: string,
  patch: Record<string, unknown>,
  correlationId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: existing, error: readErr } = await ctx.supabase
    .from("public_market_listings")
    .select("id, vendor_id, branch_id, listing_slug, public_price")
    .eq("id", listingId)
    .eq("tenant_id", ctx.tenantId)
    .maybeSingle();
  if (readErr || !existing) return { ok: false, error: readErr?.message ?? "Listing not found" };

  const next = { ...patch, refreshed_at: new Date().toISOString() };
  const { error } = await ctx.supabase.from("public_market_listings").update(next).eq("id", listingId).eq("tenant_id", ctx.tenantId);
  if (error) return { ok: false, error: error.message };

  const eventType =
    patch.public_price !== undefined && patch.public_price !== existing.public_price
      ? MarketListingAuditEventTypes.LISTING_PRICE_CHANGED
      : MarketListingAuditEventTypes.LISTING_GEO_UPDATED;

  await appendListingAudit(ctx.supabase, {
    tenant_id: ctx.tenantId,
    vendor_id: existing.vendor_id as string,
    listing_id: listingId,
    event_type: eventType,
    payload: { patch_keys: Object.keys(patch) },
  });

  await emitBrainEventForWorkspace({
    eventType:
      eventType === MarketListingAuditEventTypes.LISTING_PRICE_CHANGED
        ? BrainEventTypes.LISTING_PRICE_CHANGED
        : BrainEventTypes.LISTING_GEO_UPDATED,
    module: "market_space",
    tenantId: ctx.tenantId,
    branchId: (existing.branch_id as string) ?? null,
    actorId: ctx.userId,
    actorType: "user",
    entityType: "market_listing",
    entityId: listingId,
    occurredAt: new Date().toISOString(),
    severity: "info",
    correlationId,
    payload: { listing_slug: existing.listing_slug },
  });

  return { ok: true };
}
