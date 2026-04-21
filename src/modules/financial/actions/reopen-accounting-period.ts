"use server";

import { authorizeForCurrentUser } from "@/modules/authz/authorization-guard";
import { logGovernanceEvent } from "@/modules/authz/audit-log.service";
import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";

/**
 * Pack 2 enforcement example.
 * This action is designed to be wired to the future finance period lock UI.
 */
export async function reopenAccountingPeriod(input: { periodCode: string; reason: string }) {
  const ws = await getDashboardWorkspace();
  const actor = await getServerAuthUser();
  if (!ws?.tenant?.id || !actor) return { ok: false as const, error: "Not signed in / no workspace" };

  const authz = await authorizeForCurrentUser({
    permissionKey: "finance.period.reopen",
    scopeEntityType: "desk",
    scopeCode: "finance_desk",
    critical: { reason: input.reason },
  });
  if (!authz.allowed) return { ok: false as const, denied: authz };

  // Backend enforcement example: for now this is an authorization + audit hook point.
  await logGovernanceEvent({
    actorUserId: actor.id,
    tenantId: ws.tenant.id,
    entityType: "finance_period",
    entityId: null,
    actionCode: "finance_period_reopen_requested",
    oldValue: null,
    newValue: { periodCode: input.periodCode },
    reason: input.reason,
    metadata: { permissionKey: "finance.period.reopen" },
  });

  return { ok: true as const };
}

