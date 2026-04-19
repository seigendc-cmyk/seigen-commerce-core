"use client";

import { useEffect, useState } from "react";
import {
  approveScheduleChangeRequest,
  listPendingScheduleChangeRequests,
  rejectScheduleChangeRequest,
  SCHEDULE_APPROVAL_QUEUE_UPDATED,
  type ScheduleChangeRequest,
} from "@/modules/financial/services/schedule-change-queue";
import {
  emitCashPlanScheduleChangeResolvedBrainEvent,
} from "@/modules/brain/brain-actions";
import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";

function moneyDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium" });
  } catch {
    return iso;
  }
}

export function CashPlanScheduleApprovalsPanel() {
  const [pending, setPending] = useState<ScheduleChangeRequest[]>([]);

  useEffect(() => {
    const load = () => setPending(listPendingScheduleChangeRequests());
    load();
    window.addEventListener(SCHEDULE_APPROVAL_QUEUE_UPDATED, load);
    return () => window.removeEventListener(SCHEDULE_APPROVAL_QUEUE_UPDATED, load);
  }, []);

  if (pending.length === 0) return null;

  return (
    <section className="vendor-panel-soft rounded-2xl p-6">
      <h2 className="text-base font-semibold text-white">Pending payment / collection date changes</h2>
      <p className="mt-1 text-sm text-neutral-400">
        Missed supplier or customer dates require approval before the calendar updates. Review each request and approve
        or reject. Staff are notified via Brain when a request is submitted and when it is resolved.
      </p>
      <ul className="mt-4 space-y-3">
        {pending.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3"
          >
            <div className="min-w-0 text-sm">
              <p className="font-medium text-neutral-100">
                {r.kind === "creditor" ? "Creditor (payable)" : "Debtor (receivable)"}: {r.entityName}
              </p>
              <p className="mt-0.5 text-xs text-neutral-400">
                Proposed: {moneyDate(r.proposedDateIso)}
                {r.previousDateKey ? ` · Was due (effective): ${r.previousDateKey}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                className="rounded-lg bg-emerald-600/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
                onClick={() => {
                  const row = { ...r };
                  const res = approveScheduleChangeRequest(row.id);
                  if (!res.ok) return;
                  const b = InventoryRepo.getDefaultBranch();
                  void emitCashPlanScheduleChangeResolvedBrainEvent({
                    requestId: row.id,
                    kind: row.kind,
                    entityId: row.entityId,
                    entityName: row.entityName,
                    resolution: "approved",
                    proposedDateIso: row.proposedDateIso,
                    branchId: b.id,
                    correlationId: row.id,
                  });
                }}
              >
                Approve
              </button>
              <button
                type="button"
                className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-white/5"
                onClick={() => {
                  const row = { ...r };
                  const res = rejectScheduleChangeRequest(row.id);
                  if (!res.ok) return;
                  const b = InventoryRepo.getDefaultBranch();
                  void emitCashPlanScheduleChangeResolvedBrainEvent({
                    requestId: row.id,
                    kind: row.kind,
                    entityId: row.entityId,
                    entityName: row.entityName,
                    resolution: "rejected",
                    proposedDateIso: row.proposedDateIso,
                    branchId: b.id,
                    correlationId: row.id,
                  });
                }}
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
