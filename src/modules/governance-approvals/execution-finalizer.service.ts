import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";
import { authorizeForCurrentUser } from "@/modules/authz/authorization-guard";
import { logGovernanceEvent } from "@/modules/authz/audit-log.service";
import { EXECUTION_HANDLERS } from "./execution-handlers";
import * as repo from "./approval-repo";

function nowIso() {
  return new Date().toISOString();
}

/**
 * Executes ready jobs. Safe to call repeatedly (idempotent):
 * - job status gates execution
 * - handler must be idempotent
 */
export async function finalizeReadyApprovalExecution(input: { requestId: string }) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };

  const can = await authorizeForCurrentUser({ permissionKey: "approval.request.approve_high" });
  if (!can.allowed) return { ok: false as const, error: "Not permitted to execute governed approvals." };

  const bundle = await repo.getRequestBundle(ws.tenant.id, input.requestId);
  if (!bundle) return { ok: false as const, error: "Request not found." };
  const req = bundle.request;
  const job = bundle.jobs.find((j) => j.status === "ready") ?? bundle.jobs[0];
  if (!job) return { ok: false as const, error: "Execution job missing." };

  if (req.status !== "approved" && req.status !== "executed" && req.status !== "execution_failed") {
    return { ok: false as const, error: `Request is not approved (status=${req.status}).` };
  }
  if (req.status === "executed" || job.status === "completed") {
    return { ok: true as const, status: "completed" as const, result: job.resultJson ?? {} };
  }
  if (job.status !== "ready" && job.status !== "failed") {
    return { ok: false as const, error: `Job not ready (status=${job.status}).` };
  }

  const handler = EXECUTION_HANDLERS[job.handlerCode];
  if (!handler) return { ok: false as const, error: `Unknown handler: ${job.handlerCode}` };

  await repo.updateExecutionJob({ jobId: job.id, patch: { status: "running", lastError: null } });
  const res = await handler(job.payloadJson);
  if (!res.ok) {
    await repo.updateExecutionJob({ jobId: job.id, patch: { status: "failed", lastError: res.error, resultJson: res.result ?? null } });
    await repo.updateRequest({ tenantId: ws.tenant.id, requestId: req.id, patch: { status: "execution_failed" } });
    await logGovernanceEvent({
      tenantId: ws.tenant.id,
      actorUserId: user.id,
      entityType: "approval_execution_job",
      entityId: job.id,
      actionCode: "approval.execution.failed",
      reason: res.error,
      metadata: { requestId: req.id, handler: job.handlerCode },
    });
    return { ok: false as const, error: res.error };
  }

  await repo.updateExecutionJob({ jobId: job.id, patch: { status: "completed", resultJson: res.result ?? {} } });
  await repo.updateRequest({ tenantId: ws.tenant.id, requestId: req.id, patch: { status: "executed", executedAt: nowIso() } });
  await logGovernanceEvent({
    tenantId: ws.tenant.id,
    actorUserId: user.id,
    entityType: "approval_execution_job",
    entityId: job.id,
    actionCode: "approval.execution.completed",
    metadata: { requestId: req.id, handler: job.handlerCode },
  });
  return { ok: true as const, status: "completed" as const, result: res.result ?? {} };
}

