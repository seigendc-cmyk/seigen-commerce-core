"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { authzCheck } from "@/modules/authz/authz-actions";
import { rbacGetMatrixData, rbacSaveRolePermissions } from "@/modules/authz/rbac-admin-actions";

type PermRow = {
  id: string;
  permission_key: string;
  label: string;
  description: string | null;
  module_code: string;
  category_code: string;
  risk_level: string;
  scope_type: string;
  is_protected: boolean;
  is_destructive: boolean;
  is_approval_capable: boolean;
  dependsOnKeys: string[];
};

export function PermissionMatrixPage() {
  const sp = useSearchParams();
  const rolesParam = sp.get("roles");
  const initialRoleIds = useMemo(() => (rolesParam ? rolesParam.split(",").filter(Boolean).slice(0, 5) : []), [rolesParam]);

  const [roleIds, setRoleIds] = useState<string[]>(initialRoleIds);
  const [matrix, setMatrix] = useState<{
    roles: any[];
    permissions: PermRow[];
    grants: string[];
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [editRoleId, setEditRoleId] = useState<string>("");
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState("");
  const [module, setModule] = useState<string>("all");
  const [risk, setRisk] = useState<string>("all");
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setErr(null);
    if (roleIds.length === 0) {
      setMatrix(null);
      return;
    }
    const r = await rbacGetMatrixData(roleIds);
    if (!r.ok) {
      setErr("error" in r ? String(r.error) : "denied" in r ? String((r as any).denied?.reasonMessage) : "Failed");
      setMatrix(null);
      return;
    }
    setMatrix({ roles: r.roles as any[], permissions: r.permissions as PermRow[], grants: r.grants as string[] });
    const perm = await authzCheck("system.permissions.manage");
    setCanEdit(perm.allowed);
    const tenantRoles = (r.roles as any[]).filter((x) => !x.is_system && x.tenant_id);
    setEditRoleId((cur) => {
      if (cur && tenantRoles.some((t) => t.id === cur)) return cur;
      return tenantRoles[0]?.id ?? "";
    });
    setDirty({});
  }, [roleIds]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const grantSet = useMemo(() => new Set(matrix?.grants ?? []), [matrix]);

  function granted(roleId: string, permId: string) {
    const k = `${roleId}:${permId}`;
    if (dirty[k] !== undefined) return dirty[k];
    return grantSet.has(k);
  }

  function setCell(roleId: string, permId: string, on: boolean) {
    if (!canEdit || roleId !== editRoleId) return;
    const k = `${roleId}:${permId}`;
    const base = grantSet.has(k);
    if (on === base) {
      setDirty((d) => {
        const n = { ...d };
        delete n[k];
        return n;
      });
    } else {
      setDirty((d) => ({ ...d, [k]: on }));
    }
  }

  const perms = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return (matrix?.permissions ?? []).filter((p) => {
      if (module !== "all" && p.module_code !== module) return false;
      if (risk !== "all" && p.risk_level !== risk) return false;
      if (!qq) return true;
      return p.permission_key.toLowerCase().includes(qq) || p.label.toLowerCase().includes(qq);
    });
  }, [matrix, q, module, risk]);

  const modules = useMemo(() => {
    const s = new Set((matrix?.permissions ?? []).map((p) => p.module_code));
    return ["all", ...Array.from(s).sort()];
  }, [matrix]);

  async function save() {
    if (!editRoleId || !matrix) return;
    const permIds = new Set<string>();
    for (const p of matrix.permissions) {
      if (granted(editRoleId, p.id)) permIds.add(p.id);
    }
    const keys = matrix.permissions.filter((p) => permIds.has(p.id)).map((p) => p.permission_key);
    const depsMissing: string[] = [];
    for (const p of matrix.permissions) {
      if (!permIds.has(p.id)) continue;
      for (const depKey of p.dependsOnKeys ?? []) {
        const dep = matrix.permissions.find((x) => x.permission_key === depKey);
        if (!dep || !permIds.has(dep.id)) depsMissing.push(`${p.permission_key} → requires ${depKey}`);
      }
    }
    if (depsMissing.length) {
      const ok = window.confirm(`Dependency warnings:\n${depsMissing.slice(0, 8).join("\n")}\n\nSave anyway?`);
      if (!ok) return;
    }
    const critical = matrix.permissions.filter((p) => permIds.has(p.id) && p.risk_level === "critical");
    if (critical.length) {
      const reason = window.prompt(`Saving ${critical.length} critical permission(s). Enter audit reason:`, "Matrix save");
      if (reason === null) return;
      setSaving(true);
      const r = await rbacSaveRolePermissions({ roleId: editRoleId, permissionKeys: keys, reason });
      setSaving(false);
      if (!r.ok) window.alert("error" in r ? String(r.error) : "Save denied");
      else void refresh();
      return;
    }
    setSaving(true);
    const r = await rbacSaveRolePermissions({ roleId: editRoleId, permissionKeys: keys, reason: "Matrix save" });
    setSaving(false);
    if (!r.ok) window.alert("error" in r ? String(r.error) : "Save denied");
    else void refresh();
  }

  return (
    <div className="space-y-4">
      <section className="vendor-panel-soft rounded-2xl p-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-neutral-400">
            <span className="mb-1 block font-semibold text-neutral-200">Role IDs (comma, max 5)</span>
            <input
              className="vendor-field w-full min-w-[280px] rounded-lg px-3 py-2 font-mono text-xs sm:min-w-[420px]"
              value={roleIds.join(",")}
              onChange={(e) =>
                setRoleIds(
                  e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .slice(0, 5),
                )
              }
            />
          </label>
          <label className="text-xs text-neutral-400">
            <span className="mb-1 block font-semibold text-neutral-200">Edit target (tenant role)</span>
            <select
              className="vendor-field rounded-lg px-3 py-2 text-sm"
              value={editRoleId}
              onChange={(e) => setEditRoleId(e.target.value)}
            >
              {(matrix?.roles ?? [])
                .filter((r: any) => !r.is_system && r.tenant_id)
                .map((r: any) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.role_code})
                  </option>
                ))}
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canEdit || !editRoleId || saving || Object.keys(dirty).length === 0}
            onClick={() => void save()}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-40"
          >
            Save changes
          </button>
          <button
            type="button"
            disabled={Object.keys(dirty).length === 0}
            onClick={() => setDirty({})}
            className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-40"
          >
            Discard unsaved
          </button>
        </div>
        {!canEdit ? <p className="mt-2 text-xs text-amber-200">View-only: missing `system.permissions.manage` for your Supabase RBAC user.</p> : null}
        {err ? <p className="mt-2 text-sm text-amber-200">{err}</p> : null}
      </section>

      <section className="vendor-panel-soft rounded-2xl p-5">
        <div className="flex flex-wrap gap-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search permissions…" className="vendor-field flex-1 rounded-lg px-3 py-2 text-sm" />
          <select value={module} onChange={(e) => setModule(e.target.value)} className="vendor-field rounded-lg px-3 py-2 text-sm">
            {modules.map((m) => (
              <option key={m} value={m}>
                {m === "all" ? "All modules" : m}
              </option>
            ))}
          </select>
          <select value={risk} onChange={(e) => setRisk(e.target.value)} className="vendor-field rounded-lg px-3 py-2 text-sm">
            <option value="all">All risk</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </section>

      <section className="vendor-panel-soft overflow-hidden rounded-2xl">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/95 text-xs text-neutral-400">
              <tr>
                <th className="sticky left-0 z-20 min-w-[240px] bg-slate-950/95 px-3 py-2">Permission</th>
                {(matrix?.roles ?? []).map((r: any) => (
                  <th key={r.id} className="min-w-[120px] px-2 py-2 text-center font-semibold text-neutral-200">
                    <div className="line-clamp-2">{r.name}</div>
                    <div className="mt-0.5 font-mono text-[10px] font-normal text-neutral-500">{r.role_code}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {perms.map((p) => (
                <tr key={p.id} className="border-b border-white/[0.06]">
                  <td className="sticky left-0 z-10 bg-slate-950/90 px-3 py-2 align-top">
                    <div className="font-medium text-neutral-100">{p.label}</div>
                    <div className="font-mono text-[10px] text-neutral-500">{p.permission_key}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-neutral-300">{p.risk_level}</span>
                      {p.is_approval_capable ? (
                        <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] text-violet-100">Approval</span>
                      ) : null}
                      {(p.dependsOnKeys ?? []).length ? (
                        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-100" title={(p.dependsOnKeys ?? []).join(", ")}>
                          Deps
                        </span>
                      ) : null}
                    </div>
                  </td>
                  {(matrix?.roles ?? []).map((r: any) => {
                    const on = granted(r.id, p.id);
                    const isDirty = dirty[`${r.id}:${p.id}`] !== undefined;
                    const editable = canEdit && r.id === editRoleId && !r.is_system;
                    return (
                      <td key={r.id + p.id} className={`px-2 py-2 text-center ${isDirty ? "bg-teal-600/10" : ""}`}>
                        {editable ? (
                          <input type="checkbox" checked={on} onChange={(e) => setCell(r.id, p.id, e.target.checked)} />
                        ) : (
                          <span className={on ? "text-emerald-300" : "text-neutral-600"}>{on ? "●" : "○"}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
