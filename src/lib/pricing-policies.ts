/**
 * seiGEN Commerce — licensing & commercial policy constants.
 * Enforcement (locks, listing removal, BI) is applied in API / jobs using these values.
 */

/** Days after subscription expiry before hard lock (warnings precede this). */
export const SUBSCRIPTION_GRACE_PERIOD_DAYS = 3;

/** CAH (iConnect) vendor connectivity — priced separately from base plan (weekly). */
export const CAH_VENDOR_WEEKLY_USD = 2;

export const CAH_VENDOR_WEEKLY_CENTS = CAH_VENDOR_WEEKLY_USD * 100;

/** Policy: upgrades apply immediately (features unlock on successful billing / plan change). */
export const UPGRADE_EFFECT: "immediate" = "immediate";

/** Policy: downgrades apply at end of paid cycle (features restricted after renewal date). */
export const DOWNGRADE_EFFECT: "end_of_cycle" = "end_of_cycle";

/**
 * When false, vendor-facing app routes should block and marketplace should hide listings.
 * Wired when subscription + grace evaluation is implemented server-side.
 */
export type LicenseEnforcementMode = "strict" | "soft";

export const DEFAULT_LICENSE_ENFORCEMENT: LicenseEnforcementMode = "strict";

/** Data ownership: vendor-owned vs platform-owned aggregates (for contracts / Console copy). */
export const DATA_OWNERSHIP = {
  vendorOwns: ["business_records", "catalog_content", "customer_records_tenant_scoped"] as const,
  platformOwns: [
    "infrastructure_operations",
    "bi_event_stream",
    "aggregate_scoring_models",
    "anonymized_demand_signals",
  ] as const,
} as const;
