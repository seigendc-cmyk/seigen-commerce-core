/**
 * Client-side hints until Supabase enforces global uniqueness and org verification.
 * Replace SIMULATED_* with API calls to tenants / registry services.
 */

export function normalizeBusinessName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Well-known corporate names — using these requires proof of authority. */
export const PUBLIC_ORGANIZATION_NAMES = new Set([
  "microsoft corporation",
  "microsoft",
  "google llc",
  "google",
  "apple inc",
  "apple",
  "amazon.com inc",
  "amazon",
  "meta platforms inc",
  "meta",
  "tesla inc",
  "tesla",
]);

/** Demo: names already claimed by another vendor (simulates duplicate). */
export const SIMULATED_TAKEN_NAMES = new Set([
  "ivo motor spares",
  "acme retail holdings",
  "global parts distributors",
]);

export type NameAssessment = "empty" | "ok" | "taken" | "public_organization";

export function assessBusinessDisplayName(value: string): NameAssessment {
  const n = normalizeBusinessName(value);
  if (!n) return "empty";
  if (SIMULATED_TAKEN_NAMES.has(n)) return "taken";
  if (PUBLIC_ORGANIZATION_NAMES.has(n)) return "public_organization";
  return "ok";
}
