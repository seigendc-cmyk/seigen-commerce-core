/**
 * Temporary read-model stubs until Supabase queries + publish pipeline land.
 * Contract follows SOT §8 response shapes (extensible).
 */
export const PUBLIC_MARKET_API_VERSION = "0";

export function marketSpaceHomePayload() {
  return {
    ok: true as const,
    apiVersion: PUBLIC_MARKET_API_VERSION,
    featuredProducts: [] as unknown[],
    trendingCategories: [] as unknown[],
    verifiedVendors: [] as unknown[],
    geoLocalizedSuggestions: [] as unknown[],
  };
}

export function marketSpaceListingsPayload(query: Record<string, string | string[] | undefined>) {
  return {
    ok: true as const,
    apiVersion: PUBLIC_MARKET_API_VERSION,
    query,
    items: [] as unknown[],
    page: { limit: 24, offset: 0, total: 0 },
  };
}

export function marketSpaceListingDetailPayload(slug: string) {
  return {
    ok: true as const,
    apiVersion: PUBLIC_MARKET_API_VERSION,
    slug,
    listing: null as unknown,
    vendor: null as unknown,
    storefront: null as unknown,
    relatedListings: [] as unknown[],
    geoContext: null as unknown,
  };
}

export function marketSpaceVendorPayload(slug: string) {
  return {
    ok: true as const,
    apiVersion: PUBLIC_MARKET_API_VERSION,
    slug,
    vendor: null as unknown,
    storefronts: [] as unknown[],
  };
}

export function marketSpaceCategoriesPayload() {
  return {
    ok: true as const,
    apiVersion: PUBLIC_MARKET_API_VERSION,
    categories: [] as unknown[],
  };
}

export function itredSearchPayload(query: Record<string, string | string[] | undefined>) {
  return {
    ok: true as const,
    apiVersion: PUBLIC_MARKET_API_VERSION,
    channel: "itred_search" as const,
    query,
    results: [] as unknown[],
  };
}

export function itredSuggestionsPayload(query: Record<string, string | string[] | undefined>) {
  return {
    ok: true as const,
    apiVersion: PUBLIC_MARKET_API_VERSION,
    query,
    suggestions: [] as string[],
    popularProducts: [] as unknown[],
    nearbyCategories: [] as unknown[],
    intentCompletions: [] as string[],
  };
}
