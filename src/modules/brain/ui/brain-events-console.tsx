"use client";

import { useCallback, useEffect, useState } from "react";
import { listBrainEvents, type BrainEventRow } from "@/modules/brain/brain-actions";
import { BrainEventTypes } from "@/modules/brain/types/brain-event";

function formatIso(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function BrainEventsConsole() {
  const [module, setModule] = useState("");
  const [eventType, setEventType] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [events, setEvents] = useState<BrainEventRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<BrainEventRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const r = await listBrainEvents({
      module: module.trim() || undefined,
      eventType: eventType.trim() || undefined,
      tenantId: tenantId.trim() || undefined,
      from: from.trim() || undefined,
      to: to.trim() || undefined,
      limit: 200,
    });
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      setEvents([]);
      return;
    }
    setEvents(r.events);
  }, [module, eventType, tenantId, from, to]);

  useEffect(() => {
    void load();
    // Initial load only; filter changes apply via "Apply filters"
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-white/10 px-4 py-5 sm:px-6">
        <h1 className="text-lg font-semibold text-white">Brain events</h1>
        <p className="mt-1 max-w-3xl text-sm text-neutral-400">
          Operational memory stream — raw facts from emitters (start:{" "}
          <code className="rounded bg-white/10 px-1 text-xs text-brand-orange">{BrainEventTypes.POS_SALE_COMPLETED}</code>
          ). Rules, alerts, and scores build on this layer later.
        </p>
      </header>

      <div className="border-b border-white/10 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-neutral-500" htmlFor="be-module">
              Module
            </label>
            <input
              id="be-module"
              value={module}
              onChange={(e) => setModule(e.target.value)}
              placeholder="e.g. pos"
              className="mt-1 w-36 rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-white placeholder:text-neutral-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500" htmlFor="be-type">
              Event type
            </label>
            <input
              id="be-type"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              placeholder="pos.sale.completed"
              className="mt-1 w-52 rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-white placeholder:text-neutral-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500" htmlFor="be-tenant">
              Tenant id
            </label>
            <input
              id="be-tenant"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder="uuid"
              className="mt-1 w-72 rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 font-mono text-xs text-white placeholder:text-neutral-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500" htmlFor="be-from">
              From (ISO)
            </label>
            <input
              id="be-from"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder="2026-04-01T00:00:00.000Z"
              className="mt-1 w-56 rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 font-mono text-xs text-white placeholder:text-neutral-600"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500" htmlFor="be-to">
              To (ISO)
            </label>
            <input
              id="be-to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 w-56 rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 font-mono text-xs text-white"
            />
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-white hover:bg-brand-orange-hover"
          >
            Apply filters
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-4 sm:px-6">
        {error ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{error}</div>
        ) : null}
        {loading ? (
          <p className="text-sm text-neutral-500">Loading events…</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-neutral-500">No events match. Complete a POS sale while signed in with a workspace.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase text-neutral-500">
                  <th className="px-3 py-2 font-medium">Occurred</th>
                  <th className="px-3 py-2 font-medium">Module</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Severity</th>
                  <th className="px-3 py-2 font-medium">Tenant</th>
                  <th className="px-3 py-2 font-medium">Entity</th>
                  <th className="px-3 py-2 font-medium">Actor</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id} className="border-b border-white/5 hover:bg-white/[0.04]">
                    <td className="whitespace-nowrap px-3 py-2 text-neutral-300">{formatIso(ev.occurred_at)}</td>
                    <td className="px-3 py-2 text-neutral-200">{ev.module}</td>
                    <td className="font-mono text-xs text-neutral-300">{ev.event_type}</td>
                    <td className="px-3 py-2 text-neutral-400">{ev.severity}</td>
                    <td className="max-w-[140px] truncate font-mono text-xs text-neutral-500" title={ev.tenant_id ?? ""}>
                      {ev.tenant_id ?? "—"}
                    </td>
                    <td className="text-neutral-300">
                      {ev.entity_type}:{ev.entity_id.slice(0, 12)}…
                    </td>
                    <td className="font-mono text-xs text-neutral-500">{ev.actor_id ? ev.actor_id.slice(0, 8) + "…" : "—"}</td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => setDetail(ev)}
                        className="text-brand-orange hover:underline"
                      >
                        Payload
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detail ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="brain-payload-title"
        >
          <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={() => setDetail(null)} />
          <div className="relative z-10 max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-white/15 bg-neutral-950 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <h2 id="brain-payload-title" className="text-sm font-semibold text-white">
                Event payload
              </h2>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="rounded-lg border border-white/20 px-3 py-1 text-xs text-neutral-300 hover:bg-white/10"
              >
                Close
              </button>
            </div>
            <pre className="max-h-[70vh] overflow-auto p-4 text-xs leading-relaxed text-emerald-100/90">
              {JSON.stringify(
                {
                  id: detail.id,
                  event_type: detail.event_type,
                  module: detail.module,
                  tenant_id: detail.tenant_id,
                  branch_id: detail.branch_id,
                  actor_id: detail.actor_id,
                  actor_type: detail.actor_type,
                  entity_type: detail.entity_type,
                  entity_id: detail.entity_id,
                  occurred_at: detail.occurred_at,
                  severity: detail.severity,
                  correlation_id: detail.correlation_id,
                  payload: detail.payload,
                  created_at: detail.created_at,
                },
                null,
                2,
              )}
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}
