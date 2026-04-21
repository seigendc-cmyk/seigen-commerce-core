import { describe, expect, it } from "vitest";
import type { PolicySimulationInput } from "./policy-simulation.service";

describe("policy simulation input", () => {
  it("supports require approval toggle shape", () => {
    const x: PolicySimulationInput = {
      kind: "require_approval_toggle",
      permissionKey: "pos.sale.void",
      windowDays: 7,
      proposedRequiresApproval: true,
    };
    expect(x.permissionKey).toBe("pos.sale.void");
  });
});

