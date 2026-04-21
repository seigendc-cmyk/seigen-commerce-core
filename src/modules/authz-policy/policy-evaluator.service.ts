import type { ExecutionPolicyRow, PolicyEvaluationContext, PolicyEvaluationResult } from "./types";

function num(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function thresholdCrossed(policy: ExecutionPolicyRow, ctx: PolicyEvaluationContext): boolean {
  const tt = policy.thresholdType;
  const tv = policy.thresholdValue;
  if (!tt || tt === "none" || tv == null) return false;

  if (tt === "amount") return num(ctx.amount) != null && num(ctx.amount)! > tv;
  if (tt === "quantity") return num(ctx.quantity) != null && num(ctx.quantity)! > tv;
  if (tt === "variance") return num(ctx.variance) != null && Math.abs(num(ctx.variance)!) > tv;
  if (tt === "percentage") return num(ctx.percentage) != null && Math.abs(num(ctx.percentage)!) > tv;
  if (tt === "margin_delta") return num(ctx.marginDelta) != null && num(ctx.marginDelta)! < tv;
  if (tt === "record_age") return num(ctx.recordAgeHours) != null && num(ctx.recordAgeHours)! > tv;
  return false;
}

function appliesWhenMatches(when: Record<string, unknown> | null, ctx: PolicyEvaluationContext): boolean {
  if (!when || Object.keys(when).length === 0) return true;
  return Object.entries(when).every(([k, expect]) => {
    const got = ctx[k];
    if (typeof expect === "boolean") return Boolean(got) === expect;
    return got === expect;
  });
}

/**
 * Determines whether approval / step-up / reason gates apply for this attempt.
 */
export function evaluateExecutionPolicy(
  policy: ExecutionPolicyRow | null,
  ctx: PolicyEvaluationContext,
): PolicyEvaluationResult {
  if (!policy || !policy.isActive) {
    return {
      policy: null,
      approvalRequired: false,
      stepUpRequired: false,
      reasonRequired: false,
      thresholdTriggered: false,
      appliesWhenMatched: true,
    };
  }

  const reasonRequired = policy.requiresReason;
  const appliesWhenMatched = appliesWhenMatches(policy.appliesWhenJson, ctx);
  const thresholdTriggered = thresholdCrossed(policy, ctx);

  let approvalRequired = false;
  if (policy.requiresApproval) {
    const when = policy.appliesWhenJson;
    const hasWhen = Boolean(when && Object.keys(when).length > 0);
    const hasThreshold = Boolean(policy.thresholdType && policy.thresholdType !== "none" && policy.thresholdValue != null);

    if (hasWhen) approvalRequired = appliesWhenMatches(when, ctx);
    else if (hasThreshold) approvalRequired = thresholdTriggered;
    else approvalRequired = true;
  }

  return {
    policy,
    approvalRequired,
    stepUpRequired: policy.requiresStepUp,
    reasonRequired,
    thresholdTriggered,
    appliesWhenMatched,
  };
}
