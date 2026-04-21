import { describe, expect, it } from "vitest";
import { evaluateExecutionPolicy } from "./policy-evaluator.service";
import type { ExecutionPolicyRow } from "./types";

function basePolicy(patch: Partial<ExecutionPolicyRow>): ExecutionPolicyRow {
  return {
    id: "p1",
    tenantId: null,
    permissionKey: "inventory.adjustment.post",
    requiresReason: false,
    requiresStepUp: false,
    requiresApproval: false,
    approvalPolicyCode: null,
    stepUpPolicyCode: null,
    thresholdType: null,
    thresholdValue: null,
    appliesWhenJson: null,
    riskLevelOverride: null,
    isActive: true,
    ...patch,
  };
}

describe("authz-policy execution policy evaluator", () => {
  it("requires approval only above threshold", () => {
    const pol = basePolicy({ requiresApproval: true, thresholdType: "variance", thresholdValue: 10 });
    expect(evaluateExecutionPolicy(pol, { variance: 9 }).approvalRequired).toBe(false);
    expect(evaluateExecutionPolicy(pol, { variance: 11 }).approvalRequired).toBe(true);
  });

  it("requires approval when applies_when matches", () => {
    const pol = basePolicy({ requiresApproval: true, appliesWhenJson: { dispatch_assigned: true } });
    expect(evaluateExecutionPolicy(pol, { dispatchAssigned: false } as any).approvalRequired).toBe(false);
    expect(evaluateExecutionPolicy(pol, { dispatch_assigned: true } as any).approvalRequired).toBe(true);
  });
});

