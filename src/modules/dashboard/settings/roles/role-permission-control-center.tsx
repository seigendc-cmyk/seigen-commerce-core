"use client";

import { useMemo, useState } from "react";
import { DASHBOARD_MENU_PERMISSIONS } from "@/modules/dashboard/settings/roles/dashboard-menu-permissions";
import {
  PERMISSION_CATEGORIES,
  PERMISSIONS,
  listPermissionsByCategory,
  type PermissionDef,
  type PermissionRisk,
} from "@/modules/dashboard/settings/roles/permission-catalog";
import { useVendorRoles } from "@/modules/dashboard/settings/roles/vendor-roles-context";
import { useVendorStaff } from "@/modules/dashboard/settings/staff/vendor-staff-context";
import { computeDeskEligibilityForRole } from "@/modules/desk/services/desk-eligibility";
import { appendDeskAuditEvent } from "@/modules/desk/services/desk-audit";
import {
  getOverridesForStaff,
  setOverridesForStaff,
} from "@/modules/dashboard/settings/roles/user-permission-overrides-store";
import type { DeskKind } from "@/modules/desk/types/desk-profile";

function norm(s: string) {
  return (s || "").trim().toLowerCase();
}

function codeLabel(p: PermissionDef) {
  return `${p.label} (${p.code})`;
}

function toggle(set: Set<string>, code: string, on: boolean) {
  if (on) set.add(code);
  else set.delete(code);
}

function riskOrder(r: PermissionRisk): number {
  if (r === "critical") return 0;
  if (r === "high") return 1;
  if (r === "medium") return 2;
  return 3;
}

export function RolePermissionControlCenter() {
  const { roles, updateRole, addRole, removeRole } = useVendorRoles();
  const { staffMembers } = useVendorStaff();

  const [activeCategory, setActiveCategory] = useState(PERMISSION_CATEGORIES[0]!.id);
  const [search, setSearch] = useState("");
  const [risk, setRisk] = useState<PermissionRisk | "all">("all");
  const [drawerPerm, setDrawerPerm] = useState<PermissionDef | null>(null);
  const [roleDrawerId, setRoleDrawerId] = useState<string>("");

  const [compareMode, setCompareMode] = useState(false);
  const [compareRoleIds, setCompareRoleIds] = useState<string[]>(() => roles.slice(0, 4).map((r) => r.id));

  const [overridesStaffId, setOverridesStaffId] = useState<string>(() => staffMembers[0]?.id ?? "");
  const overrides = useMemo(
    () => (overridesStaffId ? getOverridesForStaff(overridesStaffId) : null),
    [overridesStaffId],
  );

  const byCategory = useMemo(() => listPermissionsByCategory(), []);
  const permsInCategory = useMemo(() => byCategory.get(activeCategory) ?? [], [byCategory, activeCategory]);

  const filteredPerms = useMemo(() => {
    const q = norm(search);
    return permsInCategory
      .filter((p) => (risk === "all" ? true : p.risk === risk))
      .filter((p) => (q ? norm(codeLabel(p)).includes(q) : true))
      .slice()
      .sort((a, b) => riskOrder(a.risk) - riskOrder(b.risk) || a.label.localeCompare(b.label));
  }, [permsInCategory, search, risk]);

  const visibleRoles = useMemo(() => {
    if (!compareMode) return roles;
    const set = new Set(compareRoleIds);
    return roles.filter((r) => set.has(r.id));
  }, [roles, compareMode, compareRoleIds]);

  const roleDrawer = useMemo(() => roles.find((r) => r.id === roleDrawerId) ?? null, [roles, roleDrawerId]);

  const DESK_KIND_OPTIONS: Array<{ id: DeskKind; label: string }> = [
    { id: "sysadmin", label: "SysAdmin" },
    { id: "management", label: "Management" },
    { id: "supervisor", label: "Supervisor" },
    { id: "finance", label: "Finance" },
    { id: "inventory", label: "Inventory" },
    { id: "sales-supervisor", label: "Sales supervisor" },
    { id: "operations", label: "Operations" },
    { id: "custom", label: "Custom" },
  ];

  function ensureParentsOn(set: Set<string>, p: PermissionDef) {
    for (const parent of p.parents ?? []) set.add(parent);
  }

  function cascadeOff(set: Set<string>, code: string) {
    set.delete(code);
    for (const p of PERMISSIONS) {
      if (p.parents?.includes(code)) cascadeOff(set, p.code);
    }
  }

  function setRolePermission(roleId: string, p: PermissionDef, on: boolean) {
    const role = roles.find((r) => r.id === roleId);
    if (!role) return;
    const prev = new Set(role.permissionCodes ?? []);
    const next = new Set(role.permissionCodes ?? []);

    if (on) {
      ensureParentsOn(next, p);
      toggle(next, p.code, true);
    } else {
      cascadeOff(next, p.code);
    }

    updateRole(roleId, { permissionCodes: Array.from(next) });
    appendDeskAuditEvent({
      sourceKind: "security",
      sourceId: roleId,
      action: "rbac.role_permission.changed",
      actorStaffId: null,
      actorLabel: "SysAdmin",
      moduleKey: "settings",
      entityType: "role",
      entityId: roleId,
      beforeState: { permissionCodes: Array.from(prev) },
      afterState: { permissionCodes: Array.from(next), changed: p.code, value: on },
      notes: p.sensitive ? "Sensitive permission change." : null,
    });
  }

  function setRoleMenu(roleId: string, menuId: string, on: boolean) {
    const role = roles.find((r) => r.id === roleId);
    if (!role) return;
    const prev = new Set(role.allowedMenuIds ?? []);
    const next = new Set(role.allowedMenuIds ?? []);
    if (menuId === "overview") next.add("overview" as any);
    else if (on) next.add(menuId as any);
    else next.delete(menuId as any);
    next.add("overview" as any);
    updateRole(roleId, { allowedMenuIds: Array.from(next) as any });
    appendDeskAuditEvent({
      sourceKind: "security",
      sourceId: roleId,
      action: "rbac.role_menu.changed",
      actorStaffId: null,
      actorLabel: "SysAdmin",
      moduleKey: "settings",
      entityType: "role",
      entityId: roleId,
      beforeState: { allowedMenuIds: Array.from(prev) },
      afterState: { allowedMenuIds: Array.from(next), changed: menuId, value: on },
    });
  }

  return (
    <div className="space-y-6">
      <div className="vendor-panel-soft rounded-2xl px-5 py-4 text-sm text-neutral-300">
        <p className="font-medium text-white">Role &amp; Permission Control Center</p>
        <p className="mt-1 text-neutral-400">
          Categories on the left, permission matrix in the center, and user-level overrides below. Changes are audited
          locally and are backend-ready for Supabase enforcement later.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const id = addRole();
              // Make new role immediately usable/editable (name + desk defaults).
              updateRole(id, {
                name: "New role",
                description: "",
                permissionCodes: [],
                allowedMenuIds: ["overview"] as any,
                deskEnabled: true,
                terminalOnly: false,
                deskKind: "management",
              });
              // Also compute eligibility heuristics (non-destructive) once name is edited later.
              void computeDeskEligibilityForRole(null);
              setRoleDrawerId(id);
            }}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
          >
            New Role
          </button>
          <button
            type="button"
            onClick={() => setCompareMode((v) => !v)}
            className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            {compareMode ? "Exit compare" : "Compare roles"}
          </button>
          <button
            type="button"
            onClick={() => {
              const blob = JSON.stringify(
                roles.map((r) => ({
                  id: r.id,
                  name: r.name,
                  menus: r.allowedMenuIds,
                  permissions: r.permissionCodes ?? [],
                })),
                null,
                2,
              );
              void navigator.clipboard.writeText(blob);
            }}
            className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            Export permission map
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search permission…"
            className="vendor-field w-[min(360px,90vw)] rounded-lg px-3 py-2 text-sm"
          />
          <select
            className="vendor-field rounded-lg px-3 py-2 text-sm"
            value={risk}
            onChange={(e) => setRisk(e.target.value as any)}
          >
            <option value="all">All risks</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <aside className="vendor-panel-soft rounded-2xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Categories</p>
          <div className="mt-3 space-y-1">
            {PERMISSION_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCategory(c.id)}
                className={
                  activeCategory === c.id
                    ? "w-full rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-left text-sm font-semibold text-teal-600"
                    : "w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-neutral-200 hover:bg-white/5"
                }
              >
                {c.label}
              </button>
            ))}
          </div>
        </aside>

        <section className="vendor-panel-soft rounded-2xl p-4">
          {compareMode ? (
            <div className="mb-3 flex flex-wrap gap-2">
              {roles.map((r) => (
                <label key={r.id} className="flex items-center gap-2 text-xs text-neutral-300">
                  <input
                    type="checkbox"
                    checked={compareRoleIds.includes(r.id)}
                    onChange={(e) => {
                      const set = new Set(compareRoleIds);
                      if (e.target.checked) set.add(r.id);
                      else set.delete(r.id);
                      setCompareRoleIds(Array.from(set));
                    }}
                  />
                  {r.name.trim() || "Untitled"}
                </label>
              ))}
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.04] text-xs font-semibold uppercase tracking-wide text-neutral-400">
                <tr>
                  <th className="px-3 py-2">Permission</th>
                  {visibleRoles.map((r) => (
                    <th key={r.id} className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => setRoleDrawerId(r.id)}
                        className="w-full text-center text-neutral-200 hover:text-white"
                        title="Edit role profile"
                      >
                        {r.name.trim() || "Untitled"}
                      </button>
                      {!r.id.startsWith("preset-") ? (
                        <button
                          type="button"
                          className="mt-1 text-[10px] text-neutral-400 hover:text-neutral-200"
                          onClick={() => {
                            if (window.confirm(`Remove role “${r.name.trim() || r.id}”?`)) removeRole(r.id);
                          }}
                        >
                          Remove
                        </button>
                      ) : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPerms.map((p) => (
                  <tr key={p.code} className="border-b border-white/[0.06] last:border-0">
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => setDrawerPerm(p)} className="text-left">
                        <div className="font-semibold text-neutral-100">{p.label}</div>
                        <div className="mt-0.5 font-mono text-[11px] text-neutral-500">{p.code}</div>
                        <div className="mt-0.5 text-xs text-neutral-400">
                          risk: <span className="font-semibold text-neutral-200">{p.risk}</span>
                          {p.parents?.length ? ` · depends on ${p.parents.length} parent(s)` : ""}
                        </div>
                      </button>
                    </td>
                    {visibleRoles.map((r) => {
                      const set = new Set(r.permissionCodes ?? []);
                      const checked = set.has(p.code);
                      const parentOk = (p.parents ?? []).every((x) => set.has(x));
                      const disabled = p.parents?.length ? !parentOk && !checked : false;
                      return (
                        <td key={r.id} className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={(e) => setRolePermission(r.id, p, e.target.checked)}
                            title={disabled ? "Enable parent permissions first" : undefined}
                            className="h-4 w-4 rounded border-neutral-600 bg-neutral-800 text-teal-600 focus:ring-teal-500 disabled:opacity-40"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {filteredPerms.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-sm text-neutral-400" colSpan={1 + visibleRoles.length}>
                      No permissions match your filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="mt-5 rounded-xl border border-white/10 bg-neutral-900/20 p-4">
            <p className="text-sm font-semibold text-white">Sidebar menu (legacy mapping)</p>
            <p className="mt-1 text-xs text-neutral-400">
              Menu access remains for backward compatibility. Long-term, routes/services will enforce permission keys.
            </p>
            <div className="mt-3 overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b border-white/10 bg-white/[0.04] text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  <tr>
                    <th className="px-3 py-2">Menu</th>
                    {visibleRoles.map((r) => (
                      <th key={r.id} className="px-3 py-2 text-center">
                        {r.name.trim() || "Untitled"}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DASHBOARD_MENU_PERMISSIONS.map((m) => (
                    <tr key={m.id} className="border-b border-white/[0.06] last:border-0">
                      <td className="px-3 py-2">
                        <div className="font-semibold text-neutral-100">{m.label}</div>
                        <div className="mt-0.5 font-mono text-[11px] text-neutral-500">{m.id}</div>
                      </td>
                      {visibleRoles.map((r) => {
                        const checked = r.allowedMenuIds.includes(m.id);
                        return (
                          <td key={r.id} className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={m.id === "overview"}
                              onChange={(e) => setRoleMenu(r.id, m.id, e.target.checked)}
                              className="h-4 w-4 rounded border-neutral-600 bg-neutral-800 text-teal-600 focus:ring-teal-500 disabled:opacity-50"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-neutral-900/20 p-4">
            <p className="text-sm font-semibold text-white">User-level overrides</p>
            <p className="mt-1 text-xs text-neutral-400">
              Apply exceptions for a named staff member without changing the role template.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-xs text-neutral-400">
                <span className="mb-1 block font-medium text-neutral-300">Staff member</span>
                <select
                  className="vendor-field w-full rounded-lg px-3 py-2 text-sm text-white"
                  value={overridesStaffId}
                  onChange={(e) => setOverridesStaffId(e.target.value)}
                >
                  {staffMembers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {`${s.firstName} ${s.lastName}`.trim() || s.email || s.id}
                    </option>
                  ))}
                </select>
              </label>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-neutral-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Override summary</p>
                <p className="mt-1">
                  allow: <span className="font-mono">{overrides?.allow.length ?? 0}</span> · deny:{" "}
                  <span className="font-mono">{overrides?.deny.length ?? 0}</span>
                </p>
              </div>
            </div>

            {overrides ? (
              <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-[980px] text-left text-sm">
                  <thead className="border-b border-white/10 bg-white/[0.04] text-xs font-semibold uppercase tracking-wide text-neutral-400">
                    <tr>
                      <th className="px-3 py-2">Permission</th>
                      <th className="px-3 py-2 text-center">Allow</th>
                      <th className="px-3 py-2 text-center">Deny</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PERMISSIONS.slice()
                      .sort((a, b) => a.label.localeCompare(b.label))
                      .slice(0, 120)
                      .map((p) => {
                        const allow = overrides.allow.includes(p.code);
                        const deny = overrides.deny.includes(p.code);
                        return (
                          <tr key={p.code} className="border-b border-white/[0.06] last:border-0">
                            <td className="px-3 py-2">
                              <div className="font-semibold text-neutral-100">{p.label}</div>
                              <div className="mt-0.5 font-mono text-[11px] text-neutral-500">{p.code}</div>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={allow}
                                onChange={(e) => {
                                  const nextAllow = new Set(overrides.allow);
                                  const nextDeny = new Set(overrides.deny);
                                  if (e.target.checked) {
                                    nextAllow.add(p.code);
                                    nextDeny.delete(p.code);
                                  } else {
                                    nextAllow.delete(p.code);
                                  }
                                  setOverridesForStaff(
                                    {
                                      ...overrides,
                                      allow: Array.from(nextAllow),
                                      deny: Array.from(nextDeny),
                                      updatedAt: overrides.updatedAt,
                                    },
                                    "SysAdmin",
                                  );
                                }}
                              />
                            </td>
                            <td className="px-3 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={deny}
                                onChange={(e) => {
                                  const nextAllow = new Set(overrides.allow);
                                  const nextDeny = new Set(overrides.deny);
                                  if (e.target.checked) {
                                    nextDeny.add(p.code);
                                    nextAllow.delete(p.code);
                                  } else {
                                    nextDeny.delete(p.code);
                                  }
                                  setOverridesForStaff(
                                    {
                                      ...overrides,
                                      allow: Array.from(nextAllow),
                                      deny: Array.from(nextDeny),
                                      updatedAt: overrides.updatedAt,
                                    },
                                    "SysAdmin",
                                  );
                                }}
                              />
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      {drawerPerm ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-3 py-4 lg:items-center">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900">{drawerPerm.label}</div>
                <div className="mt-0.5 font-mono text-xs text-slate-600">{drawerPerm.code}</div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerPerm(null)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
            <div className="px-5 py-5 text-sm text-slate-800">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Risk</div>
                  <div className="mt-1 font-semibold">{drawerPerm.risk}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Modules affected</div>
                  <div className="mt-1 font-mono text-xs">{drawerPerm.moduleKeys.join(", ")}</div>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-slate-200 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</div>
                <div className="mt-1">{drawerPerm.description}</div>
              </div>
              {drawerPerm.parents?.length ? (
                <div className="mt-4 rounded-xl border border-slate-200 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dependencies</div>
                  <div className="mt-1 font-mono text-xs">{drawerPerm.parents.join(", ")}</div>
                </div>
              ) : null}
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Governance</div>
                <div className="mt-1 text-sm">
                  {drawerPerm.risk === "critical" || drawerPerm.risk === "high"
                    ? "High/critical permissions should be audited and may require approvals or step-up verification."
                    : "Low/medium permissions should still be audited for changes."}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {roleDrawer ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-3 py-4 lg:items-center">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-white/10 bg-white/[0.04] px-5 py-4">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">Role profile</div>
                <div className="mt-0.5 font-mono text-xs text-neutral-500">{roleDrawer.id}</div>
              </div>
              <button
                type="button"
                onClick={() => setRoleDrawerId("")}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs text-neutral-400 sm:col-span-2">
                  <span className="mb-1 block font-medium text-neutral-300">Role name</span>
                  <input
                    className="vendor-field w-full rounded-lg px-3 py-2 text-sm text-white"
                    value={roleDrawer.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      updateRole(roleDrawer.id, { name });
                      const elig = computeDeskEligibilityForRole({ ...roleDrawer, name });
                      // Non-destructive: only apply if role hasn't been explicitly set.
                      updateRole(roleDrawer.id, {
                        deskEnabled: roleDrawer.deskEnabled ?? elig.hasDesk,
                        terminalOnly: roleDrawer.terminalOnly ?? elig.isTerminalOnly,
                        deskKind: roleDrawer.deskKind ?? elig.deskKind,
                      });
                    }}
                    placeholder="e.g. Senior Branch Manager"
                  />
                </label>
                <label className="block text-xs text-neutral-400 sm:col-span-2">
                  <span className="mb-1 block font-medium text-neutral-300">Description</span>
                  <input
                    className="vendor-field w-full rounded-lg px-3 py-2 text-sm text-white"
                    value={roleDrawer.description ?? ""}
                    onChange={(e) => updateRole(roleDrawer.id, { description: e.target.value })}
                    placeholder="What this role can do"
                  />
                </label>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-sm font-semibold text-white">Desk behavior</div>
                <div className="mt-1 text-xs text-neutral-500">
                  Terminal-only roles should not see full desks (e.g., Cashier).
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <label className="flex items-start gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-neutral-200">
                    <input
                      type="checkbox"
                      checked={Boolean(roleDrawer.deskEnabled)}
                      onChange={(e) =>
                        updateRole(roleDrawer.id, {
                          deskEnabled: e.target.checked,
                          terminalOnly: e.target.checked ? false : roleDrawer.terminalOnly,
                        })
                      }
                      className="mt-1 h-4 w-4 rounded border-neutral-600 bg-neutral-800 text-teal-600 focus:ring-teal-500"
                    />
                    <span>
                      <span className="font-semibold text-white">Desk enabled</span>
                      <span className="mt-0.5 block text-xs text-neutral-500">Show Desk + approvals/notifications.</span>
                    </span>
                  </label>

                  <label className="flex items-start gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-neutral-200">
                    <input
                      type="checkbox"
                      checked={Boolean(roleDrawer.terminalOnly)}
                      onChange={(e) =>
                        updateRole(roleDrawer.id, {
                          terminalOnly: e.target.checked,
                          deskEnabled: e.target.checked ? false : roleDrawer.deskEnabled,
                        })
                      }
                      className="mt-1 h-4 w-4 rounded border-neutral-600 bg-neutral-800 text-teal-600 focus:ring-teal-500"
                    />
                    <span>
                      <span className="font-semibold text-white">Terminal-only</span>
                      <span className="mt-0.5 block text-xs text-neutral-500">Hide Desk; limit to POS surface.</span>
                    </span>
                  </label>

                  <label className="block text-xs text-neutral-400">
                    <span className="mb-1 block font-medium text-neutral-300">Desk kind</span>
                    <select
                      className="vendor-field w-full rounded-lg px-3 py-2 text-sm text-white"
                      value={roleDrawer.deskKind ?? "management"}
                      onChange={(e) => updateRole(roleDrawer.id, { deskKind: e.target.value as DeskKind })}
                      disabled={!roleDrawer.deskEnabled}
                    >
                      {DESK_KIND_OPTIONS.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-neutral-500">
                  Tip: Use the permission matrix to grant access after naming the role.
                </div>
                {!roleDrawer.id.startsWith("preset-") ? (
                  <button
                    type="button"
                    className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-100 hover:bg-rose-500/15"
                    onClick={() => {
                      if (!window.confirm(`Delete role “${roleDrawer.name.trim() || roleDrawer.id}”?`)) return;
                      const id = roleDrawer.id;
                      setRoleDrawerId("");
                      removeRole(id);
                      appendDeskAuditEvent({
                        sourceKind: "security",
                        sourceId: id,
                        action: "rbac.role.deleted",
                        actorStaffId: null,
                        actorLabel: "SysAdmin",
                        moduleKey: "settings",
                        entityType: "role",
                        entityId: id,
                        beforeState: { name: roleDrawer.name, description: roleDrawer.description ?? "" },
                        afterState: null,
                      });
                    }}
                  >
                    Delete role
                  </button>
                ) : (
                  <div className="text-[11px] text-neutral-500">Preset role cannot be deleted.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

