"use client";

import { useEffect, useState } from "react";
import { rbacListPermissionAuditLogs } from "@/modules/authz/rbac-admin-actions";
import { summarizePermissionAuditEvent } from "@/modules/rbac-admin/lib/rbac-summarize-audit";

export function AuditHistoryPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<any | null>(null);

  useEffect(() => {
    void (async () => {
      const r = await rbacListPermissionAuditLogs({ limit: 150 });
      if (!r.ok) {
        setErr("error" in r ? String(r.error) : "Not authorized (system.audit.view)");
        setRows([]);
        return;
      }
      setErr(null);
      setRows(r.events ?? []);
    })();
  }, []);

  return (
    <div className="space-y-4">
      <section className="vendor-panel-soft rounded-2xl p-5">
        <h2 className="text-base font-semibold text-white">Governance audit</h2>
        <p className="mt-1 text-sm text-neutral-400">`permission_audit_logs` — RBAC role, permission, override, and scope changes.</p>
        {err ? <p className="mt-3 text-sm text-amber-200">{err}</p> : null}
      </section>
      <section className="vendor-panel-soft overflow-hidden rounded-2xl">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="sticky top-0 border-b border-white/10 bg-slate-950/95 text-xs uppercase text-neutral-400">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Entity</th>
                <th className="px-3 py-2">Summary</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="cursor-pointer border-b border-white/[0.06] hover:bg-white/[0.04]" onClick={() => setOpen(e)}>
                  <td className="px-3 py-2 text-xs text-neutral-400">
                    {new Date(e.created_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-neutral-200">{e.action_code}</td>
                  <td className="px-3 py-2 text-xs text-neutral-400">
                    {e.entity_type} {e.entity_id ? e.entity_id.slice(0, 8) + "…" : ""}
                  </td>
                  <td className="px-3 py-2 text-xs text-neutral-300">{summarizePermissionAuditEvent(e)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-slate-950 p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-white">Event detail</h3>
              <button type="button" className="text-sm text-neutral-400 hover:text-white" onClick={() => setOpen(null)}>
                Close
              </button>
            </div>
            <p className="mt-2 text-sm text-neutral-400">{summarizePermissionAuditEvent(open)}</p>
            <pre className="mt-4 max-h-[50vh] overflow-auto rounded-lg bg-black/40 p-3 text-[11px] text-neutral-300">
              {JSON.stringify({ old: open.old_value, new: open.new_value, meta: open.metadata, reason: open.reason }, null, 2)}
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}
