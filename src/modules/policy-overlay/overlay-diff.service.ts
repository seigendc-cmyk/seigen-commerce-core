import { diffPolicyDefinitions } from "@/modules/policy-lifecycle/policy-diff.service";

export function diffOverlayAgainstBase(input: {
  baseDefinitionJson: Record<string, unknown>;
  overlayDefinitionJson: Record<string, unknown>;
}): { changedKeys: string[]; summary: string } {
  const merged = applyOverlayMerge(input.baseDefinitionJson, input.overlayDefinitionJson);
  const d = diffPolicyDefinitions(input.baseDefinitionJson, merged);
  return { changedKeys: d.changedKeys, summary: d.summary };
}

export function applyOverlayMerge(base: Record<string, unknown>, overlay: Record<string, unknown>): Record<string, unknown> {
  const deepMerge = (b: any, o: any): any => {
    if (Array.isArray(b) || Array.isArray(o)) return o ?? b;
    if (b && typeof b === "object" && o && typeof o === "object") {
      const out: Record<string, any> = { ...b };
      for (const [k, v] of Object.entries(o)) out[k] = deepMerge((b as any)[k], v);
      return out;
    }
    return o === undefined ? b : o;
  };
  return deepMerge(base, overlay) ?? {};
}

