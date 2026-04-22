/** Mirrors `public.market_listing_publish_status` enum in Supabase. */
export type MarketListingPublishStatus =
  | "draft"
  | "pending_review"
  | "publish_ready"
  | "published"
  | "suspended"
  | "hidden_out_of_stock"
  | "archived"
  | "rejected";
