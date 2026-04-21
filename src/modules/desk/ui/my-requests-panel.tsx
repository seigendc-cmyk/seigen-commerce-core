"use client";

import type { ApprovalRequest } from "@/modules/desk/types/approval";

function statusChip(s: ApprovalRequest["status"]) {
  if (s === "approved" || s === "executed") return "vc-badge-success";
  if (s === "rejected" || s === "cancelled") return "vc-badge-danger";
  if (s === "returned") return "vc-badge-warning";
  return "vc-badge-pending";
}

export function MyRequestsPanel({ requests }: { requests: ApprovalRequest[] }) {
  return (
    <section className="vc-card">
      <h2 className="font-heading text-base font-semibold text-slate-900">My requests</h2>
      <p className="mt-1 text-sm text-slate-600">Track everything you initiated and its current status.</p>
      {requests.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No requests yet.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {requests.slice(0, 20).map((r) => (
            <li key={r.id} className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900">{r.title}</div>
                  <div className="mt-0.5 text-xs text-slate-600">{r.summary || r.reason}</div>
                  <div className="mt-1 font-mono text-[11px] text-slate-500">
                    {r.moduleKey} · {new Date(r.requestedAt).toLocaleString(undefined, { dateStyle: "medium" })}
                  </div>
                </div>
                <span className={statusChip(r.status)}>{r.status.replaceAll("_", " ")}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
