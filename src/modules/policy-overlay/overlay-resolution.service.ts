import { resolveEffectivePolicyForContext } from "@/modules/governance-federation/applicability-resolver.service";

export async function resolveEffectivePolicyWithOverlays(input: {
  policyCode: string;
  scopeChain: Array<{ scopeType: "global" | "trust" | "distribution_group" | "region" | "country" | "tenant" | "branch"; scopeId: string }>;
  asOfIso?: string;
}) {
  return resolveEffectivePolicyForContext({ policyCode: input.policyCode, scopeChain: input.scopeChain, asOfIso: input.asOfIso });
}

