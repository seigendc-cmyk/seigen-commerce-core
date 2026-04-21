"use client";

import { useMemo } from "react";
import type { ApprovalRequest } from "@/modules/desk/types/approval";
import { listApprovalAuditTrail } from "@/modules/desk/services/approval-engine";
import { WindowControls } from "@/components/ui/window-controls";

export function ApprovalDetailDrawer({
  open,
  request,
  onClose,
}: {
  open: boolean;
  request: ApprovalRequest | null;
  onClose: () => void;
}) {
  const trail = useMemo(() => (request ? listApprovalAuditTrail(request.id) : []), [request]);
  if (!open || !request) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-3 py-4 lg:items-center">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">{request.title}</div>
            <div className="mt-0.5 text-xs text-slate-600">
              {request.moduleKey} · {request.actionKey} · step {request.currentStep}/{request.totalSteps} · status{" "}
              {request.status}
            </div>
          </div>
          <WindowControls minimized={false} onMinimize={() => {}} onRestore={() => {}} onClose={onClose} />
        </div>
        <div className="max-h-[80vh] overflow-auto px-5 py-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
            <div className="font-semibold">Summary</div>
            <div className="mt-1 whitespace-pre-wrap">{request.summary || request.reason || "—"}</div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4 text-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Initiated by</div>
              <div className="mt-1 font-semibold text-slate-900">{request.initiatedByLabel}</div>
              <div className="mt-1 text-xs text-slate-600">
                {new Date(request.requestedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 text-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Entity</div>
              <div className="mt-1 font-semibold text-slate-900">
                {request.entityType} · {request.entityId}
              </div>
              <div className="mt-1 text-xs text-slate-600">priority {request.priority}</div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 p-4">
            <div className="text-sm font-semibold text-slate-900">Audit trail</div>
            {trail.length === 0 ? (
              <div className="mt-2 text-sm text-slate-600">No decisions recorded yet.</div>
            ) : (
              <ul className="mt-3 space-y-2">
                {trail.map((d) => (
                  <li key={d.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold text-slate-900">
                        {d.decision.toUpperCase()} · step {d.stepNumber}
                      </div>
                      <div className="text-xs text-slate-600">
                        {new Date(d.occurredAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                      </div>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-700">
                      by {d.actorLabel}
                      {d.note ? ` · ${d.note}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

