"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DASHBOARD_MENU_PERMISSIONS,
  type DashboardMenuPermissionId,
} from "./dashboard-menu-permissions";
import { useVendorRoles, type VendorRoleRow } from "./vendor-roles-context";

function nextMenuIds(
  role: VendorRoleRow,
  menuId: DashboardMenuPermissionId,
  checked: boolean,
): DashboardMenuPermissionId[] {
  const set = new Set(role.allowedMenuIds);
  if (menuId === "overview") {
    set.add("overview");
    return Array.from(set) as DashboardMenuPermissionId[];
  }
  if (checked) set.add(menuId);
  else set.delete(menuId);
  set.add("overview");
  return Array.from(set) as DashboardMenuPermissionId[];
}

function displayRoleName(name: string): string {
  const t = name.trim();
  return t.length > 0 ? t : "Untitled role";
}

export function RolesPermissionsForm() {
  const { roles, updateRole, addRole: addRoleToContext, removeRole: removeRoleFromContext } = useVendorRoles();

  /** Only one role expanded at a time; empty string = all collapsed. */
  const [expandedRoleId, setExpandedRoleId] = useState<string>("");

  const [savedHint, setSavedHint] = useState<string | null>(null);

  useEffect(() => {
    if (expandedRoleId && !roles.some((r) => r.id === expandedRoleId)) {
      setExpandedRoleId("");
    }
  }, [roles, expandedRoleId]);

  const addRole = useCallback(() => {
    const id = addRoleToContext();
    setExpandedRoleId(id);
  }, [addRoleToContext]);

  const removeRole = useCallback(
    (id: string) => {
      removeRoleFromContext(id);
    },
    [removeRoleFromContext],
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavedHint("Draft saved locally — persist roles to Supabase when tenant RBAC is wired.");
    window.setTimeout(() => setSavedHint(null), 4000);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="vendor-panel-soft rounded-2xl px-5 py-4 text-sm text-neutral-300">
        <p className="font-medium text-white">Roles & menu permissions</p>
        <p className="mt-1 text-neutral-400">
          Define named roles and map each to sidebar menus. Plan gates still apply before role checks until enforcement
          is connected. Roles stay collapsed until you open one; only one editor is open at a time — add a role to open it
          and collapse the rest.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-white">Roles</h2>
        <button
          type="button"
          onClick={addRole}
          className="rounded-lg border border-white/20 bg-neutral-800/80 px-3 py-1.5 text-sm font-semibold text-neutral-100 hover:bg-neutral-700"
        >
          Add role
        </button>
      </div>

      <div className="space-y-3">
        {roles.map((role, index) => {
          const isOpen = expandedRoleId !== "" && expandedRoleId === role.id;
          const menuCount = role.allowedMenuIds.length;

          return (
            <div key={role.id} className="vendor-panel rounded-2xl">
              {!isOpen ? (
                <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-5">
                  <button
                    type="button"
                    onClick={() => setExpandedRoleId(role.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Role {index + 1}
                    </span>
                    <span className="min-w-0 truncate font-medium text-white">{displayRoleName(role.name)}</span>
                    <span className="shrink-0 text-xs text-neutral-500">
                      · {menuCount} menu{menuCount === 1 ? "" : "s"}
                    </span>
                    <span className="shrink-0 text-neutral-500" aria-hidden>
                      ▸
                    </span>
                  </button>
                  {roles.length > 1 ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRole(role.id);
                      }}
                      className="shrink-0 text-xs font-medium text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              ) : (
                <div>
                  <div className="border-b border-white/10 px-4 py-3 sm:px-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedRoleId("")}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          Role {index + 1}
                        </span>
                        <span className="min-w-0 truncate font-medium text-white">{displayRoleName(role.name)}</span>
                        <span className="shrink-0 text-xs text-neutral-400">Click to collapse</span>
                        <span className="shrink-0 text-neutral-500" aria-hidden>
                          ▾
                        </span>
                      </button>
                      {roles.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeRole(role.id)}
                          className="text-xs font-medium text-red-400 hover:text-red-300"
                        >
                          Remove role
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium text-neutral-200" htmlFor={`role-name-${role.id}`}>
                            Role name
                          </label>
                          <input
                            id={`role-name-${role.id}`}
                            value={role.name}
                            onChange={(e) => updateRole(role.id, { name: e.target.value })}
                            className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                            placeholder="e.g. Inventory clerk, Branch admin"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium text-neutral-200" htmlFor={`role-desc-${role.id}`}>
                            Description
                          </label>
                          <input
                            id={`role-desc-${role.id}`}
                            value={role.description}
                            onChange={(e) => updateRole(role.id, { description: e.target.value })}
                            className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                            placeholder="What this role is for"
                          />
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-neutral-200">Menu access</p>
                        <p className="mt-0.5 text-xs text-neutral-500">
                          Tied to vendor sidebar entries. At least Overview stays on so users can land in the app.
                        </p>
                        <ul className="mt-3 space-y-2">
                          {DASHBOARD_MENU_PERMISSIONS.map((m) => {
                            const checked = role.allowedMenuIds.includes(m.id);
                            return (
                              <li
                                key={m.id}
                                className="flex flex-wrap items-start gap-3 rounded-lg border border-white/10 bg-neutral-900/30 px-3 py-2"
                              >
                                <input
                                  id={`${role.id}-menu-${m.id}`}
                                  type="checkbox"
                                  checked={checked}
                                  disabled={m.id === "overview"}
                                  onChange={(e) =>
                                    updateRole(role.id, {
                                      allowedMenuIds: nextMenuIds(role, m.id, e.target.checked),
                                    })
                                  }
                                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-neutral-600 bg-neutral-800 text-brand-orange focus:ring-brand-orange disabled:opacity-50"
                                />
                                <label htmlFor={`${role.id}-menu-${m.id}`} className="min-w-0 flex-1 cursor-pointer">
                                  <span className="font-medium text-white">{m.label}</span>
                                  <span className="mt-0.5 block font-mono text-[11px] text-neutral-500">{m.href}</span>
                                  <span className="mt-0.5 block text-xs text-neutral-500">{m.description}</span>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </div>
                  </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-95"
        >
          Save draft
        </button>
        {savedHint ? <p className="text-sm text-neutral-400">{savedHint}</p> : null}
      </div>
    </form>
  );
}
