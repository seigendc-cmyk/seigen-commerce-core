import { describe, expect, it } from "vitest";
import { computeWorkflowImpact } from "./workflow-impact.service";

describe("governance workflow impact", () => {
  it("flags executive/trust for critical finance control", () => {
    const i = computeWorkflowImpact({ permissionKey: "finance.period.reopen", riskLevel: "critical" });
    expect(i.modulesAffected).toContain("finance");
    expect(i.executiveVisibilitySuggested).toBe(true);
    expect(i.trustVisibilitySuggested).toBe(true);
  });
});

