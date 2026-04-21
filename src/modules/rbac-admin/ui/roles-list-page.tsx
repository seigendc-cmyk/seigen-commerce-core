"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { rbacArchiveTenantRole, rbacCompareRoles, rbacListRoles, type RbacRoleRow } from "@/modules/authz/rbac-admin-actions";

export function RolesListPage() {
  const [rows, setRows] = useState<RbacRoleRow[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "system" | "tenant" | "archived" | "active">("active");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareBody, setCompareBody] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    setLoadErr(null);
    const r = await rbacListRoles();
    setBusy(false);
    if (!r.ok) {
      setLoadErr("error" in r && r.error ? String(r.error) : "Unable to load roles.");
      setRows([]);
      return;
    }
    setRows(r.roles ?? []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const nq = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "system" && !r.is_system) return false;
      if (filter === "tenant" && (r.is_system || !r.tenant_id)) return false;
      if (filter === "archived" && !r.is_archived) return false;
      if (filter === "active" && (!r.is_active || r.is_archived)) return false;
      if (!nq) return true;
      return r.name.toLowerCase().includes(nq) || r.role_code.toLowerCase().includes(nq);
    });
  }, [rows, q, filter]);

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      const has = prev.includes(id);
      if (has) return prev.filter((x) => x !== id);
      if (prev.length >= 5) return prev;
      return [...prev, id];
    });
  }

  async function runCompare() {
    setCompareOpen(true);
    setCompareBody("Loading…");
    const r = await rbacCompareRoles(compareIds);
    if (!r.ok || !("permissionKeysUnion" in r)) {
      setCompareBody(
        "error" in r && r.error ? String(r.error) : "denied" in r ? "Not authorized." : "Compare failed.",
      );
      return;
    }
    setCompareBody(
      `Union: ${r.permissionKeysUnion.length} permissions. Critical counts: ${JSON.stringify(r.criticalCounts, null, 2)}`,
    );
  }

  async function archiveRole(id: string) {
    if (!window.confirm("Archive this tenant role? Assignments remain historical.")) return;
    const r = await rbacArchiveTenantRole({ roleId: id, reason: "Archived from Roles list" });
    if (!r.ok) {
      window.alert("error" in r ? String(r.error) : "Denied");
      return;
    }
    void refresh();
  }

  return (
    <div className="space-y-4">
      <section className="vendor-panel-soft rounded-2xl p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex min-w-[200px] flex-1 flex-col gap-2 sm:flex-row sm:items-end">
            <label className="block flex-1 text-xs text-neutral-400">
              <span className="mb-1 block font-semibold text-neutral-200">Search</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Name or role code…"
                className="vendor-field w-full rounded-lg px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs text-neutral-400">
              <span className="mb-1 block font-semibold text-neutral-200">Filter</span>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="vendor-field rounded-lg px-3 py-2 text-sm"
              >
                <option value="active">Active (default)</option>
                <option value="all">All</option>
                <option value="system">System roles</option>
                <option value="tenant">Tenant roles</option>
                <option value="archived">Archived</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/desk/security/matrix"
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
            >
              Open matrix
            </Link>
            <button
              type="button"
              disabled={compareIds.length < 2 || busy}
              onClick={() => void runCompare()}
              className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-40"
            >
              Compare ({compareIds.length})
            </button>
          </div>
        </div>
        {loadErr ? <p className="mt-3 text-sm text-amber-200">{loadErr}</p> : null}
      </section>

      <section className="vendor-panel-soft overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.04] text-xs font-semibold uppercase tracking-wide text-neutral-400">
              <tr>
                <th className="px-3 py-2">Compare</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Scope</th>
                <th className="px-3 py-2 text-right">Perms</th>
                <th className="px-3 py-2 text-right">Users</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Updated</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-white/[0.06] last:border-0">
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={compareIds.includes(r.id)} onChange={() => toggleCompare(r.id)} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-neutral-100">{r.name}</div>
                    <div className="text-xs text-neutral-500">{r.description ?? "—"}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.is_system ? (
                        <span className="rounded bg-slate-500/25 px-2 py-0.5 text-[10px] font-semibold text-slate-100">System</span>
                      ) : (
                        <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-100">Tenant</span>
                      )}
                      {r.is_protected ? (
                        <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-100">Protected</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-neutral-300">{r.role_code}</td>
                  <td className="px-3 py-2 text-xs text-neutral-400">{r.scope_type}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-neutral-300">{r.permissionCount}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-neutral-300">{r.assignedUserCount}</td>
                  <td className="px-3 py-2 text-xs">
                    {r.is_archived ? <span className="text-amber-300">Archived</span> : r.is_active ? <span className="text-emerald-300">Active</span> : <span className="text-neutral-500">Inactive</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-neutral-500">
                    {new Date(r.updated_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/dashboard/desk/security/matrix?roles=${encodeURIComponent(r.id)}`} className="text-xs font-semibold text-teal-600 hover:underline">
                        Matrix
                      </Link>
                      {!r.is_system && r.tenant_id ? (
                        <button type="button" className="text-xs font-semibold text-rose-300 hover:underline" onClick={() => void archiveRole(r.id)}>
                          Archive
                        </button>
                      ) : (
                        <span className="text-xs text-neutral-600" title="System roles cannot be archived here">
                          Locked
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 ? <p className="p-6 text-sm text-neutral-500">No roles match filters.</p> : null}
      </section>

      {compareOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog">
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-slate-950 p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-white">Role comparison</h2>
              <button type="button" className="text-sm text-neutral-400 hover:text-white" onClick={() => setCompareOpen(false)}>
                Close
              </button>
            </div>
            <pre className="mt-4 whitespace-pre-wrap text-xs text-neutral-300">{compareBody}</pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}
