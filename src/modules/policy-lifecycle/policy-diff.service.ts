import type { PolicyDiff } from "./types";

function keysDeep(o: any, prefix = ""): string[] {
  if (o == null || typeof o !== "object") return prefix ? [prefix] : [];
  const out: string[] = [];
  for (const k of Object.keys(o)) {
    const p = prefix ? `${prefix}.${k}` : k;
    out.push(...keysDeep(o[k], p));
  }
  return out;
}

export function diffPolicyDefinitions(before: Record<string, unknown>, after: Record<string, unknown>): PolicyDiff {
  const all = new Set([...keysDeep(before), ...keysDeep(after)]);
  const changed: string[] = [];
  for (const k of all) {
    const b = k.split(".").reduce<any>((acc, x) => (acc ? acc[x] : undefined), before);
    const a = k.split(".").reduce<any>((acc, x) => (acc ? acc[x] : undefined), after);
    const same = JSON.stringify(b) === JSON.stringify(a);
    if (!same) changed.push(k);
  }
  const summary = changed.length === 0 ? "No changes." : `Changed ${changed.length} field(s): ${changed.slice(0, 8).join(", ")}${changed.length > 8 ? "…" : ""}`;
  return { changedKeys: changed, before, after, summary };
}

