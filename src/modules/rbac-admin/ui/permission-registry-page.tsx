"use client";

import { useEffect, useMemo, useState } from "react";
import { rbacGetPermissionRegistry } from "@/modules/authz/rbac-admin-actions";

export function PermissionRegistryPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [module, setModule] = useState<string>("");

  useEffect(() => {
    void (async () => {
      const r = await rbacGetPermissionRegistry({ module: module || undefined });
      if (!r.ok) {
        setErr("error" in r ? String(r.error) : "Not authorized");
        setRows([]);
        return;
      }
      setErr(null);
      setRows(r.permissions ?? []);
    })();
  }, [module]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return rows;
    return rows.filter(
      (p) =>
        String(p.permission_key).toLowerCase().includes(qq) ||
        String(p.label).toLowerCase().includes(qq) ||
        String(p.description ?? "").toLowerCase().includes(qq),
    );
  }, [rows, q]);

  return (
    <div className="space-y-4">
      <section className="vendor-panel-soft flex flex-wrap gap-3 rounded-2xl p-5">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter client-side…" className="vendor-field flex-1 rounded-lg px-3 py-2 text-sm" />
        <input value={module} onChange={(e) => setModule(e.target.value)} placeholder="module_code (server)" className="vendor-field w-48 rounded-lg px-3 py-2 font-mono text-xs" />
      </section>
      {err ? <p className="text-sm text-amber-200">{err}</p> : null}
      <section className="vendor-panel-soft overflow-hidden rounded-2xl">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="sticky top-0 border-b border-white/10 bg-slate-950/95 text-xs uppercase text-neutral-400">
              <tr>
                <th className="px-3 py-2">Key</th>
                <th className="px-3 py-2">Label</th>
                <th className="px-3 py-2">Module</th>
                <th className="px-3 py-2">Risk</th>
                <th className="px-3 py-2">Scope</th>
                <th className="px-3 py-2 text-right">Deps</th>
                <th className="px-3 py-2">Flags</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-white/[0.06]">
                  <td className="px-3 py-2 font-mono text-xs text-neutral-300">{p.permission_key}</td>
                  <td className="px-3 py-2 text-neutral-100">{p.label}</td>
                  <td className="px-3 py-2 text-xs text-neutral-500">
                    {p.module_code}/{p.category_code}
                  </td>
                  <td className="px-3 py-2 text-xs">{p.risk_level}</td>
                  <td className="px-3 py-2 text-xs text-neutral-400">{p.scope_type}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-neutral-400">{p.dependencyCount ?? 0}</td>
                  <td className="px-3 py-2 text-xs text-neutral-500">
                    {p.is_destructive ? "destructive " : ""}
                    {p.is_approval_capable ? "approval " : ""}
                    {p.is_protected ? "protected " : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
