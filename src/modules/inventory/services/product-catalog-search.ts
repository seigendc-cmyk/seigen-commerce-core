import type { ProductReadModel } from "../types/product-read-model";

/**
 * Lowercase tokens from free text; words can appear in any order in the query.
 * Splits on whitespace and commas.
 */
export function parseSearchTokens(raw: string): string[] {
  return raw
    .toLowerCase()
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Flatten all list-relevant fields into one string so each token can match anywhere
 * (order of words in the query does not need to match order in the product).
 * Uses the unified `catalogSearchText` built from the full product record + sector data.
 */
export function productRowSearchHaystack(row: ProductReadModel): string {
  const parts = [
    row.catalogSearchText,
    row.primaryImage?.dataUrl ? "has image" : "no image",
    String(row.onHandQty),
    row.active ? "yes active" : "no inactive",
    row.forSale ? "for sale pos" : "not for sale admin",
    row.branchId,
    row.id,
    row.flagExternalIdeliver ? "external ideliver delivery provider" : "",
  ];
  return parts.join(" ").toLowerCase();
}

/** Every token must appear somewhere in the haystack (AND across tokens, OR across fields). */
export function productMatchesSearchTokens(row: ProductReadModel, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const hay = productRowSearchHaystack(row);
  return tokens.every((t) => hay.includes(t));
}
