"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AGENT_EVENT, listAgentNotifications, markNotificationRead } from "@/modules/consignment-agent/services/agent-storage";

function useTick() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const on = () => setT((x) => x + 1);
    window.addEventListener(AGENT_EVENT, on);
    return () => window.removeEventListener(AGENT_EVENT, on);
  }, []);
  return t;
}

export default function AgentNotificationsPage() {
  const _t = useTick();
  const rows = useMemo(() => listAgentNotifications().slice(0, 60), [_t]);

  return (
    <div className="mx-auto max-w-md px-3 py-4">
      <header className="mb-3">
        <div className="text-lg font-semibold text-neutral-100">Notifications</div>
        <div className="mt-2">
          <Link className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-100" href="/dashboard/agent">
            Back to cart
          </Link>
        </div>
      </header>

      <div className="space-y-2">
        {rows.map((n) => (
          <div key={n.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-neutral-100">{n.title}</div>
                <div className="mt-1 text-xs text-neutral-300">{n.message}</div>
                <div className="mt-1 text-xs text-neutral-500">{n.createdAt.slice(0, 16).replace("T", " ")}</div>
              </div>
              {!n.readAt ? (
                <button
                  className="rounded-lg border border-white/10 bg-neutral-950/40 px-3 py-2 text-xs font-semibold text-neutral-100"
                  onClick={() => markNotificationRead(n.id)}
                >
                  Mark read
                </button>
              ) : (
                <div className="text-xs text-neutral-500">Read</div>
              )}
            </div>
            {n.action ? (
              <div className="mt-2">
                <Link className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-neutral-950" href={n.action.href}>
                  {n.action.label}
                </Link>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

