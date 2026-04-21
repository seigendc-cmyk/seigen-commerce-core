"use client";

import type { ApprovalRequest } from "@/modules/desk/types/approval";

export function EscalationsPanel({ escalations }: { escalations: ApprovalRequest[] }) {
  if (escalations.length === 0) {
    return (
      <section className="vc-card">
        <h2 className="font-heading text-base font-semibold text-slate-900">Escalations</h2>
        <p className="mt-2 text-sm text-slate-600">No escalations at the moment.</p>
      </section>
    );
  }

  return (
    <section className="vc-card">
      <h2 className="font-heading text-base font-semibold text-slate-900">Escalations</h2>
      <p className="mt-1 text-sm text-slate-600">Overdue or escalated approvals requiring attention.</p>
      <ul className="mt-4 space-y-2">
        {escalations.slice(0, 20).map((r) => (
          <li key={r.id} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900">{r.title}</div>
                <div className="mt-0.5 text-xs text-slate-700">{r.summary || r.reason}</div>
                <div className="mt-1 font-mono text-[11px] text-slate-600">
                  due{" "}
                  {r.dueAt ? new Date(r.dueAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—"}{" "}
                  · escalation level {r.escalationLevel}
                </div>
              </div>
              <span className="vc-badge-warning">{r.status.replaceAll("_", " ")}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
