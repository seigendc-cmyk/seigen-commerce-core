"use client";

import type { DeskNotification } from "@/modules/desk/types/desk-notification";
import { acknowledgeNotification, resolveNotification } from "@/modules/desk/services/notification-service";

function sevClass(sev: DeskNotification["severity"]) {
  if (sev === "critical") return "border-rose-200 bg-rose-50";
  if (sev === "urgent") return "border-amber-200 bg-amber-50";
  if (sev === "warning") return "border-yellow-200 bg-yellow-50";
  return "border-slate-200 bg-slate-50";
}

export function NotificationsPanel({
  staffId,
  actorLabel,
  notifications,
}: {
  staffId: string;
  actorLabel: string;
  notifications: DeskNotification[];
}) {
  if (notifications.length === 0) {
    return (
      <section className="vc-card">
        <h2 className="font-heading text-base font-semibold text-slate-900">Need my attention</h2>
        <p className="mt-2 text-sm text-slate-600">No active notifications right now.</p>
      </section>
    );
  }

  return (
    <section className="vc-card">
      <h2 className="font-heading text-base font-semibold text-slate-900">Need my attention</h2>
      <p className="mt-1 text-sm text-slate-600">Notifications stay on your desk until acknowledged/resolved.</p>
      <ul className="mt-4 space-y-3">
        {notifications.slice(0, 30).map((n) => (
          <li key={n.id} className={`rounded-xl border px-4 py-3 ${sevClass(n.severity)}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-slate-900">{n.title}</p>
                <p className="mt-0.5 text-xs text-slate-600">{n.message}</p>
                <p className="mt-1 font-mono text-[11px] text-slate-500">
                  {n.moduleKey} · {new Date(n.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  className="vc-btn-secondary !px-3 !py-1.5 !text-xs"
                  onClick={() => acknowledgeNotification(n.id, staffId, actorLabel)}
                >
                  Acknowledge
                </button>
                <button
                  type="button"
                  className="vc-btn-secondary !px-3 !py-1.5 !text-xs font-medium"
                  onClick={() => resolveNotification(n.id, staffId, actorLabel)}
                >
                  Resolve
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
