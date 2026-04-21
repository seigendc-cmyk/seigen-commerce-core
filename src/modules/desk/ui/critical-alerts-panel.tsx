"use client";

import type { DeskNotification } from "@/modules/desk/types/desk-notification";

export function CriticalAlertsPanel({ notifications }: { notifications: DeskNotification[] }) {
  const critical = notifications.filter((n) => n.severity === "critical" || n.severity === "urgent");
  if (critical.length === 0) {
    return (
      <section className="vc-card">
        <h2 className="font-heading text-base font-semibold text-slate-900">Critical alerts</h2>
        <p className="mt-2 text-sm text-slate-600">No critical alerts right now.</p>
      </section>
    );
  }

  return (
    <section className="vc-card-accent-danger">
      <h2 className="font-heading text-base font-semibold text-slate-900">Critical alerts</h2>
      <p className="mt-1 text-sm text-slate-600">Urgent and critical notifications on your desk.</p>
      <ul className="mt-4 space-y-2">
        {critical.slice(0, 15).map((n) => (
          <li key={n.id} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
            <div className="text-sm font-semibold text-slate-900">{n.title}</div>
            <div className="mt-0.5 text-xs text-slate-700">{n.message}</div>
            <div className="mt-1 font-mono text-[11px] text-slate-600">
              {n.moduleKey} · {new Date(n.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
