import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createPublicAnonSupabaseClient } from "@/lib/supabase/public-anon";
import {
  itredSearchPayload,
  itredSuggestionsPayload,
  marketSpaceCategoriesPayload,
  marketSpaceHomePayload,
  marketSpaceListingDetailPayload,
  marketSpaceListingsPayload,
  marketSpaceVendorPayload,
  PUBLIC_MARKET_API_VERSION,
} from "@/modules/market-space/server/public-market-stubs";
import type { PublicMarketListingRow, PublicStorefrontRow, PublicVendorRow } from "@/modules/market-space/types/public-listing-row";
import type { SupabaseClient } from "@supabase/supabase-js";

const LISTING_LIST_COLS = [
  "id",
  "tenant_id",
  "vendor_id",
  "branch_id",
  "storefront_id",
  "product_id",
  "sku",
  "listing_slug",
  "title",
  "short_description",
  "brand",
  "category_id",
  "category_name",
  "searchable_text",
  "public_price",
  "compare_at_price",
  "currency_code",
  "stock_badge",
  "stock_signal",
  "hero_image_url",
  "image_count",
  "verification_flag",
  "trust_score",
  "freshness_score",
  "ranking_score",
  "publish_status",
  "city",
  "suburb",
  "province",
  "country",
  "lat",
  "lng",
  "radius_km",
  "pickup_supported",
  "delivery_supported",
  "visible_in_market_space",
  "visible_in_itred",
  "published_at",
  "refreshed_at",
].join(",");

function publishedMarketSpaceSelect(sb: SupabaseClient, columns: string) {
  return sb
    .from("public_market_listings")
    .select(columns)
    .eq("publish_status", "published")
    .eq("visible_in_market_space", true);
}

function publishedItredSelect(sb: SupabaseClient, columns: string) {
  return sb
    .from("public_market_listings")
    .select(columns)
    .eq("publish_status", "published")
    .eq("visible_in_itred", true);
}

function aggregateCategories(rows: { category_id: string | null; category_name: string | null }[]) {
  const m = new Map<string, { category_id: string | null; category_name: string | null; count: number }>();
  for (const r of rows) {
    const key = r.category_id ?? r.category_name ?? "uncategorized";
    const cur = m.get(key) ?? { category_id: r.category_id, category_name: r.category_name, count: 0 };
    cur.count += 1;
    m.set(key, cur);
  }
  return Array.from(m.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 24);
}

export async function readMarketSpaceHome() {
  const stub = { ...marketSpaceHomePayload(), source: "stub" as const, apiVersion: PUBLIC_MARKET_API_VERSION };
  if (!isSupabaseConfigured()) return stub;
  try {
    const sb = createPublicAnonSupabaseClient();
    const [featuredRes, vendorsRes, listingsForCats] = await Promise.all([
      publishedMarketSpaceSelect(sb, LISTING_LIST_COLS).order("ranking_score", { ascending: false, nullsFirst: false }).limit(12),
      sb.from("public_vendors").select("*").eq("active", true).order("updated_at", { ascending: false }).limit(8),
      publishedMarketSpaceSelect(sb, "category_id, category_name").limit(500),
    ]);
    if (featuredRes.error || vendorsRes.error || listingsForCats.error) return stub;
    return {
      ok: true as const,
      apiVersion: "1",
      source: "supabase" as const,
      featuredProducts: (featuredRes.data ?? []) as unknown as PublicMarketListingRow[],
      verifiedVendors: (vendorsRes.data ?? []) as unknown as PublicVendorRow[],
      trendingCategories: aggregateCategories((listingsForCats.data ?? []) as unknown as { category_id: string | null; category_name: string | null }[]),
      geoLocalizedSuggestions: [] as unknown[],
    };
  } catch {
    return stub;
  }
}

export async function readMarketSpaceListings(search: Record<string, string | string[] | undefined>) {
  const stub = { ...marketSpaceListingsPayload(search), source: "stub" as const };
  if (!isSupabaseConfigured()) return stub;
  try {
    const sb = createPublicAnonSupabaseClient();
    let q = publishedMarketSpaceSelect(sb, LISTING_LIST_COLS);
    const term = typeof search.q === "string" ? search.q.replace(/%/g, "").trim().slice(0, 80) : "";
    if (term) q = q.ilike("searchable_text", `%${term}%`);
    if (typeof search.category === "string" && search.category) q = q.eq("category_id", search.category);
    if (typeof search.brand === "string" && search.brand) q = q.ilike("brand", `%${search.brand.replace(/%/g, "").slice(0, 80)}%`);
    if (typeof search.city === "string" && search.city) q = q.ilike("city", `%${search.city.replace(/%/g, "").slice(0, 80)}%`);
    if (typeof search.suburb === "string" && search.suburb) q = q.ilike("suburb", `%${search.suburb.replace(/%/g, "").slice(0, 80)}%`);
    if (typeof search.province === "string" && search.province) q = q.ilike("province", `%${search.province.replace(/%/g, "").slice(0, 80)}%`);
    if (typeof search.country === "string" && search.country) q = q.ilike("country", `%${search.country.replace(/%/g, "").slice(0, 80)}%`);
    if (search.pickup === "true" || search.pickup === "1") q = q.eq("pickup_supported", true);
    if (search.delivery === "true" || search.delivery === "1") q = q.eq("delivery_supported", true);
    if (search.verifiedOnly === "true" || search.verifiedOnly === "1") q = q.eq("verification_flag", true);

    const minP = typeof search.minPrice === "string" ? Number(search.minPrice) : NaN;
    const maxP = typeof search.maxPrice === "string" ? Number(search.maxPrice) : NaN;
    if (Number.isFinite(minP)) q = q.gte("public_price", minP);
    if (Number.isFinite(maxP)) q = q.lte("public_price", maxP);

    const sort = typeof search.sort === "string" ? search.sort : "relevance";
    if (sort === "price_asc") q = q.order("public_price", { ascending: true });
    else if (sort === "price_desc") q = q.order("public_price", { ascending: false });
    else if (sort === "latest") q = q.order("published_at", { ascending: false, nullsFirst: false });
    else q = q.order("ranking_score", { ascending: false, nullsFirst: false });

    const limit = Math.min(48, Math.max(1, Number(search.limit) || 24));
    const offset = Math.max(0, Number(search.offset) || 0);
    const { data, error } = await q.range(offset, offset + limit - 1);
    if (error) return stub;
    return {
      ok: true as const,
      apiVersion: "1" as const,
      source: "supabase" as const,
      query: search,
      items: (data ?? []) as unknown as PublicMarketListingRow[],
      page: { limit, offset, total: null as number | null },
    };
  } catch {
    return stub;
  }
}

export async function readMarketSpaceListingDetail(slug: string) {
  const stub = { ...marketSpaceListingDetailPayload(slug), source: "stub" as const };
  if (!isSupabaseConfigured()) return stub;
  try {
    const sb = createPublicAnonSupabaseClient();
    const { data: listing, error } = await sb
      .from("public_market_listings")
      .select(LISTING_LIST_COLS)
      .eq("listing_slug", slug)
      .eq("publish_status", "published")
      .or("visible_in_market_space.eq.true,visible_in_itred.eq.true")
      .maybeSingle();
    if (error || !listing) return stub;

    const row = listing as unknown as PublicMarketListingRow;
    const [vendorRes, storefrontRes, relatedRes] = await Promise.all([
      sb.from("public_vendors").select("*").eq("tenant_id", row.tenant_id).eq("vendor_id", row.vendor_id).maybeSingle(),
      sb
        .from("public_storefronts")
        .select("*")
        .eq("tenant_id", row.tenant_id)
        .eq("storefront_id", row.storefront_id)
        .maybeSingle(),
      row.category_id
        ? publishedMarketSpaceSelect(sb, LISTING_LIST_COLS).neq("id", row.id).eq("category_id", row.category_id).limit(6)
        : publishedMarketSpaceSelect(sb, LISTING_LIST_COLS).neq("id", row.id).limit(6),
    ]);
    const related = (relatedRes.data ?? []) as unknown as PublicMarketListingRow[];
    return {
      ok: true as const,
      apiVersion: "1" as const,
      source: "supabase" as const,
      slug,
      listing: row,
      vendor: (vendorRes.data ?? null) as PublicVendorRow | null,
      storefront: (storefrontRes.data ?? null) as PublicStorefrontRow | null,
      relatedListings: related,
      geoContext: {
        city: row.city,
        suburb: row.suburb,
        province: row.province,
        country: row.country,
        lat: row.lat,
        lng: row.lng,
        radius_km: row.radius_km,
      },
    };
  } catch {
    return stub;
  }
}

export async function readMarketSpaceVendor(slug: string) {
  const stub = { ...marketSpaceVendorPayload(slug), source: "stub" as const };
  if (!isSupabaseConfigured()) return stub;
  try {
    const sb = createPublicAnonSupabaseClient();
    const { data: vendor, error } = await sb.from("public_vendors").select("*").eq("public_slug", slug).eq("active", true).maybeSingle();
    if (error || !vendor) return stub;
    const v = vendor as PublicVendorRow;
    const { data: storefronts } = await sb
      .from("public_storefronts")
      .select("*")
      .eq("tenant_id", v.tenant_id)
      .eq("vendor_id", v.vendor_id)
      .eq("active", true);
    return {
      ok: true as const,
      apiVersion: "1" as const,
      source: "supabase" as const,
      slug,
      vendor: v,
      storefronts: (storefronts ?? []) as PublicStorefrontRow[],
    };
  } catch {
    return stub;
  }
}

export async function readMarketSpaceCategories() {
  const stub = { ...marketSpaceCategoriesPayload(), source: "stub" as const };
  if (!isSupabaseConfigured()) return stub;
  try {
    const sb = createPublicAnonSupabaseClient();
    const { data, error } = await publishedMarketSpaceSelect(sb, "category_id, category_name").limit(2000);
    if (error) return stub;
    return {
      ok: true as const,
      apiVersion: "1" as const,
      source: "supabase" as const,
      categories: aggregateCategories((data ?? []) as unknown as { category_id: string | null; category_name: string | null }[]),
    };
  } catch {
    return stub;
  }
}

export async function readItredSearch(search: Record<string, string | string[] | undefined>) {
  const stub = { ...itredSearchPayload(search), source: "stub" as const };
  if (!isSupabaseConfigured()) return stub;
  try {
    const sb = createPublicAnonSupabaseClient();
    let q = publishedItredSelect(sb, LISTING_LIST_COLS);
    const term = typeof search.q === "string" ? search.q.replace(/%/g, "").trim().slice(0, 80) : "";
    if (term) q = q.ilike("searchable_text", `%${term}%`);
    if (typeof search.city === "string" && search.city) q = q.ilike("city", `%${search.city.replace(/%/g, "").slice(0, 80)}%`);
    if (typeof search.suburb === "string" && search.suburb) q = q.ilike("suburb", `%${search.suburb.replace(/%/g, "").slice(0, 80)}%`);
    if (typeof search.country === "string" && search.country) q = q.ilike("country", `%${search.country.replace(/%/g, "").slice(0, 80)}%`);
    if (typeof search.category === "string" && search.category) q = q.eq("category_id", search.category);
    if (search.deliveryOnly === "true" || search.deliveryOnly === "1") q = q.eq("delivery_supported", true);
    if (search.pickupOnly === "true" || search.pickupOnly === "1") q = q.eq("pickup_supported", true);

    const lat = Number(search.lat);
    const lng = Number(search.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const radiusKm = Number(search.radius) || 25;
      const delta = radiusKm / 111;
      q = q.gte("lat", lat - delta).lte("lat", lat + delta).gte("lng", lng - delta).lte("lng", lng + delta);
    }

    const { data, error } = await q.order("ranking_score", { ascending: false, nullsFirst: false }).limit(36);
    if (error) return stub;
    return {
      ok: true as const,
      apiVersion: "1" as const,
      source: "supabase" as const,
      channel: "itred_search" as const,
      query: search,
      results: (data ?? []) as unknown as PublicMarketListingRow[],
    };
  } catch {
    return stub;
  }
}

export async function readItredSuggestions(search: Record<string, string | string[] | undefined>) {
  const stub = { ...itredSuggestionsPayload(search), source: "stub" as const };
  if (!isSupabaseConfigured()) return stub;
  try {
    const sb = createPublicAnonSupabaseClient();
    const term = typeof search.q === "string" ? search.q.replace(/%/g, "").trim().slice(0, 40) : "";
    let q = sb
      .from("public_market_listings")
      .select("title")
      .eq("publish_status", "published")
      .eq("visible_in_itred", true)
      .limit(8);
    if (term) q = q.ilike("title", `%${term}%`);
    const { data, error } = await q;
    if (error) return stub;
    const titles = (data ?? []).map((r) => r.title as string).filter(Boolean);
    return {
      ok: true as const,
      apiVersion: "1" as const,
      source: "supabase" as const,
      query: search,
      suggestions: titles,
      popularProducts: (data ?? []) as unknown[],
      nearbyCategories: [] as unknown[],
      intentCompletions: [] as string[],
    };
  } catch {
    return stub;
  }
}
