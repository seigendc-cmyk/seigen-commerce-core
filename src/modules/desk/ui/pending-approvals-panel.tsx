"use client";

import type { ApprovalRequest } from "@/modules/desk/types/approval";
import { approveRequest, escalateRequest, rejectRequest, returnRequest } from "@/modules/desk/services/approval-engine";

function prioClass(p: ApprovalRequest["priority"]) {
  if (p === "critical") return "border-rose-200 bg-rose-50";
  if (p === "urgent") return "border-amber-200 bg-amber-50";
  if (p === "high") return "border-yellow-200 bg-yellow-50";
  return "border-slate-200 bg-slate-50";
}

export function PendingApprovalsPanel({
  approvals,
  actorStaffId,
  actorLabel,
  onOpen,
}: {
  approvals: ApprovalRequest[];
  actorStaffId: string;
  actorLabel: string;
  onOpen: (id: string) => void;
}) {
  if (approvals.length === 0) {
    return (
      <section className="vc-card">
        <h2 className="font-heading text-base font-semibold text-slate-900">Pending my approval</h2>
        <p className="mt-2 text-sm text-slate-600">No approvals waiting for you.</p>
      </section>
    );
  }

  return (
    <section className="vc-card">
      <h2 className="font-heading text-base font-semibold text-slate-900">Pending my approval</h2>
      <p className="mt-1 text-sm text-slate-600">Review and action approvals. Every decision is audited.</p>
      <ul className="mt-4 space-y-3">
        {approvals.slice(0, 30).map((r) => (
          <li key={r.id} className={`rounded-xl border px-4 py-3 ${prioClass(r.priority)}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 text-sm">
                <button type="button" className="text-left" onClick={() => onOpen(r.id)}>
                  <p className="font-semibold text-slate-900">{r.title}</p>
                  <p className="mt-0.5 text-xs text-slate-600">{r.summary || r.reason}</p>
                  <p className="mt-1 font-mono text-[11px] text-slate-500">
                    {r.moduleKey} · step {r.currentStep}/{r.totalSteps} ·{" "}
                    {new Date(r.requestedAt).toLocaleString(undefined, { dateStyle: "medium" })}
                  </p>
                </button>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  className="vc-btn-momentum !px-3 !py-1.5 !text-xs"
                  onClick={() => approveRequest({ requestId: r.id, actorStaffId, actorLabel })}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="vc-btn-danger-outline !px-3 !py-1.5 !text-xs"
                  onClick={() => {
                    const note = window.prompt("Reason for rejection (optional):") ?? undefined;
                    rejectRequest({ requestId: r.id, actorStaffId, actorLabel, note });
                  }}
                >
                  Reject
                </button>
                <button
                  type="button"
                  className="vc-btn-secondary !px-3 !py-1.5 !text-xs font-medium"
                  onClick={() => {
                    const note = window.prompt("Return note (optional):") ?? undefined;
                    returnRequest({ requestId: r.id, actorStaffId, actorLabel, note });
                  }}
                >
                  Return
                </button>
                <button
                  type="button"
                  className="vc-btn-secondary !px-3 !py-1.5 !text-xs font-medium"
                  onClick={() => {
                    const note = window.prompt("Escalation note (optional):") ?? undefined;
                    escalateRequest({ requestId: r.id, actorStaffId, actorLabel, note });
                  }}
                >
                  Escalate
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
