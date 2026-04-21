import type { ExecutionPolicyRow, StepUpAdapterResult } from "./types";
import { verifySupervisorPasscode } from "./supervisor-passcode.service";

/**
 * Pluggable step-up verification. Replace with OTP / WebAuthn / supervisor API.
 */
export async function verifyStepUp(input: {
  policyCode: string | null;
  stepUpToken: string | null | undefined;
  tenantId: string;
  userId: string;
  permissionKey?: string;
  actionCode?: string;
  entityType?: string;
  entityId?: string | null;
  /** For supervisor passcode: token format `sup:<supervisorUserId>:<passcode>` */
  reason?: string | null;
}): Promise<StepUpAdapterResult> {
  if (!input.policyCode) return { ok: true };
  const tok = (input.stepUpToken ?? "").trim();
  if (tok.length === 0) return { ok: false, error: "Step-up verification required." };

  if (input.policyCode === "supervisor_passcode") {
    const m = tok.match(/^sup:([^:]+):(.+)$/);
    if (!m) return { ok: false, error: "Supervisor token required (sup:<userId>:<passcode>)." };
    if (!input.permissionKey || !input.actionCode || !input.entityType) return { ok: false, error: "Step-up context missing." };
    const r = await verifySupervisorPasscode({
      tenantId: input.tenantId,
      requestingUserId: input.userId,
      supervisorUserId: m[1],
      supervisorPasscode: m[2],
      permissionKey: input.permissionKey,
      actionCode: input.actionCode,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      reason: input.reason ?? null,
    });
    if (!r.ok) return { ok: false, error: r.error };
    return { ok: true };
  }

  // OTP adapter stub (future): require configured provider; for now fail unless token == __stub_ok__
  if (input.policyCode === "otp_future" || input.policyCode === "re_auth_future") {
    if (tok === "__stub_ok__") return { ok: true };
    return { ok: false, error: "OTP step-up is not configured yet." };
  }

  if (tok === "__stub_fail__") return { ok: false, error: "Step-up verification failed." };
  return { ok: true };
}

export function shouldCreateStepUpEvent(policy: ExecutionPolicyRow | null): boolean {
  return Boolean(policy?.requiresStepUp && policy.stepUpPolicyCode);
}

export function resolveStepUpPolicyCode(policy: ExecutionPolicyRow | null): string {
  return policy?.stepUpPolicyCode ?? "supervisor_passcode";
}
