import { describe, expect, it } from "vitest";
import { getApprovalPolicy } from "./approval-policy-registry";

describe("governance approvals policy registry", () => {
  it("returns known policy", () => {
    const p = getApprovalPolicy("finance_period_reopen_dual_control");
    expect(p).toBeTruthy();
    expect(p?.stages.length).toBeGreaterThan(1);
    expect(p?.executionHandlerCode).toBe("finance.reopen_period");
  });

  it("returns null for unknown policy", () => {
    expect(getApprovalPolicy("nope")).toBeNull();
  });
});

