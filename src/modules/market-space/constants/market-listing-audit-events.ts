/**
 * `market_listing_events.event_type` values — append-only projection audit.
 * Keep aligned with Brain listing.* emitters where applicable.
 */
export const MarketListingAuditEventTypes = {
  LISTING_PUBLISH_REQUESTED: "listing.publish.requested",
  LISTING_PUBLISHED: "listing.published",
  LISTING_UNPUBLISHED: "listing.unpublished",
  LISTING_SUSPENDED: "listing.suspended",
  LISTING_PRICE_CHANGED: "listing.price.changed",
  LISTING_STOCK_VISIBILITY_CHANGED: "listing.stock.visibility.changed",
  LISTING_GEO_UPDATED: "listing.geo.updated",
  LISTING_STOREFRONT_CHANGED: "listing.storefront.changed",
} as const;

export type MarketListingAuditEventType =
  (typeof MarketListingAuditEventTypes)[keyof typeof MarketListingAuditEventTypes];
