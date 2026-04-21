export type OverlayValidationResult = { ok: true } | { ok: false; error: string };

/**
 * Pack 9 overlay validation: keep it deterministic and safe.
 * - Overlay must be an object (jsonb) and must not attempt to modify protected keys when provided.
 */
export function validateOverlayDefinition(input: {
  overlayDefinitionJson: unknown;
  allowedRootKeys?: string[] | null;
}): OverlayValidationResult {
  const o = input.overlayDefinitionJson;
  if (o == null || typeof o !== "object" || Array.isArray(o)) return { ok: false, error: "Overlay definition must be an object." };
  if (input.allowedRootKeys?.length) {
    const allowed = new Set(input.allowedRootKeys);
    const keys = Object.keys(o as any);
    const bad = keys.filter((k) => !allowed.has(k));
    if (bad.length) return { ok: false, error: `Overlay modifies disallowed top-level keys: ${bad.join(", ")}` };
  }
  return { ok: true };
}

