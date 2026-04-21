import type { FederationScopeType } from "./types";

export const FEDERATION_SCOPE_ORDER: FederationScopeType[] = [
  "global",
  "trust",
  "distribution_group",
  "region",
  "country",
  "tenant",
  "branch",
];

export function scopeSpecificityRank(t: FederationScopeType): number {
  // Higher = more specific
  switch (t) {
    case "branch":
      return 700;
    case "tenant":
      return 600;
    case "country":
      return 500;
    case "region":
      return 400;
    case "distribution_group":
      return 300;
    case "trust":
      return 200;
    case "global":
      return 100;
  }
}

