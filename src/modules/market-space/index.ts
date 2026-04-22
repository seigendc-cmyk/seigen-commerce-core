/**
 * Market Space + iTred — public discovery layer (SOT).
 *
 * Phase 1: Supabase projections (`public_*` tables + `market_listing_events`).
 * Phase 2+: publish pipeline, ranking, public APIs wiring to Supabase anon/service role.
 *
 * @see supabase/migrations/20260422090000_market_space_public_index.sql
 */

export * from "./constants/market-listing-audit-events";
export * from "./constants/traffic-channel";
export * from "./types/publish-status";
export * from "./types/public-listing-row";
