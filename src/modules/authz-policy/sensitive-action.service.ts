import { evaluateCriticalAction } from "@/modules/authz/critical-action.service";
import { loadPermissionMetaByKeys } from "@/modules/authz/permission-registry";
import { checkPermission } from "@/modules/authz/permission-resolver.service";
import { logGovernanceEvent } from "@/modules/authz/audit-log.service";
import { GOVERNANCE_AUDIT_ACTIONS } from "./constants";
import { createApprovalForSensitiveAction } from "./approval-link.service";
import { buildDenialExplanation, buildPolicyDenialExplanation } from "./denial-explanation.service";
import { evaluateExecutionPolicy } from "./policy-evaluator.service";
import { insertPermissionDenialEvent, insertStepUpEvent } from "./persistence";
import { loadExecutionPolicy } from "./policy-registry";
import { isReasonRequired, validateReason } from "./reason-capture.service";
import { resolveStepUpPolicyCode, verifyStepUp } from "./step-up-evaluator.service";
import type { PolicyEvaluationContext, SensitiveActionInput, SensitiveActionResult } from "./types";

async function emitAudit(
  tenantId: string,
  userId: string,
  action: string,
  metadata: Record<string, unknown>,
  reason?: string | null,
) {
  await logGovernanceEvent({
    tenantId,
    actorUserId: userId,
    entityType: "governance_sensitive_action",
    entityId: null,
    actionCode: action,
    reason: reason ?? null,
    metadata,
  });
}

function meaningfulDenial(permissionKey: string, reasonCode: string): boolean {
  if (reasonCode === "DENIED_PERMISSION_NOT_GRANTED") return true;
  if (reasonCode === "DENIED_EXPLICIT_USER_OVERRIDE") return true;
  if (permissionKey.includes("system.") || permissionKey.includes("security.")) return true;
  if (permissionKey.includes("finance.period") || permissionKey.includes("approval.request.override")) return true;
  return false;
}

export async function evaluateSensitiveAction(input: SensitiveActionInput): Promise<SensitiveActionResult> {
  const policy = await loadExecutionPolicy(input.tenantId, input.permissionKey);
  const metaMap = await loadPermissionMetaByKeys([input.permissionKey]);
  const meta = metaMap[input.permissionKey] ?? null;
  const critical = meta ? evaluateCriticalAction(input.permissionKey, meta) : null;

  const policyCtx: PolicyEvaluationContext = input.policyContext ?? {};
  const evaluated = evaluateExecutionPolicy(policy, policyCtx);

  const needReason = isReasonRequired(policy, { criticalRequiresReason: Boolean(critical?.requiresReason) });
  const reasonCheck = needReason ? validateReason(input.reason) : { ok: true as const, reason: (input.reason ?? "").trim() };

  if (needReason && !reasonCheck.ok) {
    const expl = buildPolicyDenialExplanation({
      permissionKey: input.permissionKey,
      technicalReasonCode: "GOVERNANCE_REASON_REQUIRED",
      userMessage: reasonCheck.error,
      adminMessage: "Policy or critical path requires a valid reason string.",
    });
    await emitAudit(input.tenantId, input.userId, GOVERNANCE_AUDIT_ACTIONS.reasonMissing, {
      permissionKey: input.permissionKey,
      actionCode: input.actionCode,
    });
    return {
      outcome: "reason_required",
      denialExplanation: expl,
      codes: { technicalReasonCode: "GOVERNANCE_REASON_REQUIRED" },
      auditMetadata: { permissionKey: input.permissionKey },
    };
  }

  const mergedReason = reasonCheck.ok ? reasonCheck.reason : "";

  const permResult = await checkPermission({
    tenantId: input.tenantId,
    userId: input.userId,
    permissionKey: input.permissionKey,
    scopeEntityType: input.scopeEntityType,
    scopeEntityId: input.scopeEntityId,
    scopeCode: input.scopeCode,
    critical:
      mergedReason || input.stepUpToken
        ? { reason: mergedReason || undefined, stepUpToken: input.stepUpToken ?? undefined }
        : undefined,
  });

  if (!permResult.allowed) {
    if (meaningfulDenial(input.permissionKey, permResult.reasonCode)) {
      await insertPermissionDenialEvent({
        tenantId: input.tenantId,
        userId: input.userId,
        permissionKey: input.permissionKey,
        reasonCode: permResult.reasonCode,
        scopeEntityType: input.scopeEntityType,
        scopeEntityId: input.scopeEntityId,
        deskCode: input.deskCode,
        entityType: input.entityType,
        entityId: input.entityId ?? undefined,
        contextJson: { actionCode: input.actionCode, ...input.metadata },
      });
    }
    await emitAudit(input.tenantId, input.userId, GOVERNANCE_AUDIT_ACTIONS.sensitiveDenied, {
      permissionKey: input.permissionKey,
      reasonCode: permResult.reasonCode,
    });
    return {
      outcome: "denied",
      permissionResult: permResult,
      denialExplanation: buildDenialExplanation({ permissionResult: permResult }),
      codes: { technicalReasonCode: permResult.reasonCode },
      auditMetadata: { permissionKey: input.permissionKey },
    };
  }

  // Step-up gate (policy-level; RBAC critical step-up still handled in checkPermission for critical set)
  if (evaluated.stepUpRequired) {
    const stepRes = await verifyStepUp({
      policyCode: resolveStepUpPolicyCode(policy),
      stepUpToken: input.stepUpToken,
      tenantId: input.tenantId,
      userId: input.userId,
      permissionKey: input.permissionKey,
      actionCode: input.actionCode,
      entityType: input.entityType ?? "governance",
      entityId: input.entityId ?? null,
      reason: mergedReason || null,
    });
    if (!stepRes.ok) {
      const ev = await insertStepUpEvent({
        tenantId: input.tenantId,
        userId: input.userId,
        permissionKey: input.permissionKey,
        actionCode: input.actionCode,
        entityType: input.entityType ?? "governance",
        entityId: input.entityId ?? null,
        stepUpPolicyCode: resolveStepUpPolicyCode(policy),
        status: "required",
        metadata: input.metadata ?? {},
      });
      await emitAudit(input.tenantId, input.userId, GOVERNANCE_AUDIT_ACTIONS.stepUpRequired, {
        permissionKey: input.permissionKey,
        stepUpEventId: ev.ok ? ev.id : undefined,
      });
      const expl = buildPolicyDenialExplanation({
        permissionKey: input.permissionKey,
        technicalReasonCode: "GOVERNANCE_STEP_UP_REQUIRED",
        userMessage: stepRes.ok ? "" : stepRes.error,
        adminMessage: "Execution policy requires step-up verification (OTP/passcode/supervisor).",
      });
      return {
        outcome: "pending_step_up",
        permissionResult: permResult,
        policy: evaluated,
        stepUpEventId: ev.ok ? ev.id : undefined,
        denialExplanation: expl,
        codes: {
          technicalReasonCode: "GOVERNANCE_STEP_UP_REQUIRED",
          policyStepUpCode: policy?.stepUpPolicyCode ?? null,
        },
        auditMetadata: { permissionKey: input.permissionKey },
      };
    }
  }

  if (evaluated.approvalRequired && !input.approvalRequestRef) {
    const entId = input.entityId ?? "00000000-0000-0000-0000-000000000000";
    const apr = await createApprovalForSensitiveAction({
      tenantId: input.tenantId,
      userId: input.userId,
      permissionKey: input.permissionKey,
      actionCode: input.actionCode,
      module: input.module,
      entityType: input.entityType ?? "governance",
      entityId: entId,
      title: `Approval: ${input.permissionKey}`,
      summary: mergedReason || `Governed action ${input.actionCode}`,
      reason: mergedReason || "Approval requested by policy.",
      branchId: input.branchId,
      metadata: input.metadata,
    });
    await emitAudit(input.tenantId, input.userId, GOVERNANCE_AUDIT_ACTIONS.approvalLinked, {
      permissionKey: input.permissionKey,
      approvalRequestRef: apr.ok ? apr.approvalRequestRef : null,
    });
    return {
      outcome: "pending_approval",
      permissionResult: permResult,
      policy: evaluated,
      approvalRequestRef: apr.ok ? apr.approvalRequestRef : null,
      codes: {
        technicalReasonCode: "GOVERNANCE_APPROVAL_REQUIRED",
        policyApprovalCode: policy?.approvalPolicyCode ?? null,
      },
      auditMetadata: { permissionKey: input.permissionKey },
    };
  }

  await emitAudit(input.tenantId, input.userId, GOVERNANCE_AUDIT_ACTIONS.sensitiveAllowed, {
    permissionKey: input.permissionKey,
    actionCode: input.actionCode,
    approvalRequestRef: input.approvalRequestRef ?? null,
  });

  return {
    outcome: "allowed_execute_now",
    permissionResult: permResult,
    policy: evaluated,
    codes: { technicalReasonCode: "ALLOWED" },
    auditMetadata: {
      permissionKey: input.permissionKey,
      reason: mergedReason,
      approvalRequestRef: input.approvalRequestRef ?? null,
    },
  };
}

export async function executeOrQueue(input: SensitiveActionInput): Promise<SensitiveActionResult> {
  return evaluateSensitiveAction(input);
}

/** After approvers complete desk flow — caller re-invokes evaluate with approvalRequestRef set. */
export async function finalizeApprovedExecution(input: SensitiveActionInput): Promise<SensitiveActionResult> {
  if (!input.approvalRequestRef) {
    return {
      outcome: "denied",
      codes: { technicalReasonCode: "GOVERNANCE_APPROVAL_MISSING" },
      auditMetadata: {},
      denialExplanation: buildPolicyDenialExplanation({
        permissionKey: input.permissionKey,
        technicalReasonCode: "GOVERNANCE_APPROVAL_MISSING",
        userMessage: "Approved request reference missing.",
        adminMessage: "finalizeApprovedExecution requires approvalRequestRef from the approval engine.",
      }),
    };
  }
  return evaluateSensitiveAction({ ...input, approvalRequestRef: input.approvalRequestRef });
}
