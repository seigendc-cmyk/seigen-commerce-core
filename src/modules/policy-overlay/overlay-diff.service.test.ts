import { describe, expect, it } from "vitest";
import { applyOverlayMerge, diffOverlayAgainstBase } from "./overlay-diff.service";

describe("policy-overlay merge/diff", () => {
  it("deep merges overlay fields", () => {
    const base = { approvals: { stages: 1, roles: ["manager"] }, retentionDays: 30 };
    const overlay = { approvals: { stages: 2 }, retentionDays: 45 };
    const merged = applyOverlayMerge(base as any, overlay as any);
    expect((merged as any).approvals.stages).toBe(2);
    expect((merged as any).approvals.roles[0]).toBe("manager");
    expect((merged as any).retentionDays).toBe(45);
  });

  it("diff reports changed keys", () => {
    const base = { a: 1, nested: { b: 2 } };
    const overlay = { nested: { b: 3 } };
    const d = diffOverlayAgainstBase({ baseDefinitionJson: base as any, overlayDefinitionJson: overlay as any });
    expect(d.changedKeys.some((k) => k.includes("nested.b"))).toBe(true);
  });
});

