"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { rbacGetUserAccessBundle, rbacListRoles, type RbacRoleRow } from "@/modules/authz/rbac-admin-actions";
import {
  authzAssignRole,
  authzDenyOverride,
  authzGrantOverride,
  authzRemoveOverride,
  authzRemoveRole,
  authzSetPrimaryRole,
} from "@/modules/authz/authz-actions";
import { addUserScope, listUserScopesForUser, removeUserScope } from "@/modules/authz/user-scope.service";
import { DESK_CODES, DESK_PERMISSION_KEY_BY_CODE } from "@/modules/authz/constants";

type Tab = "overview" | "roles" | "overrides" | "scope" | "desks";

export function UserAccessDetailPage({ userId }: { userId: string }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [bundle, setBundle] = useState<any>(null);
  const [rolesCatalog, setRolesCatalog] = useState<RbacRoleRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [scopes, setScopes] = useState<any[]>([]);
  const [assignRoleId, setAssignRoleId] = useState("");
  const [ovKey, setOvKey] = useState("");
  const [ovReason, setOvReason] = useState("");
  const [scopeType, setScopeType] = useState<"tenant" | "branch" | "warehouse" | "terminal" | "desk">("tenant");
  const [scopeEntityId, setScopeEntityId] = useState("");
  const [scopeCode, setScopeCode] = useState("");

  const load = useCallback(async () => {
    setErr(null);
    const b = await rbacGetUserAccessBundle(userId);
    if (!b.ok) {
      setErr("error" in b ? String(b.error) : "Unable to load user.");
      setBundle(null);
      return;
    }
    setBundle(b);
    const sc = await listUserScopesForUser(userId);
    setScopes(sc.ok ? sc.scopes : []);
    const rc = await rbacListRoles();
    if (rc.ok) setRolesCatalog(rc.roles);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const snap = bundle?.snapshot;
  const summary = useMemo(() => {
    if (!snap) return null;
    const granted = snap.effectivePermissionKeys?.length ?? 0;
    const denied = snap.deniedPermissionKeys?.length ?? 0;
    const crit = snap.riskSummary?.criticalCount ?? 0;
    return { granted, denied, crit, desks: snap.accessibleDesks?.length ?? 0 };
  }, [snap]);

  async function onAssignRole() {
    if (!assignRoleId) return;
    const r = await authzAssignRole({ targetUserId: userId, roleId: assignRoleId, reason: "Assigned from Security console" });
    if (!r.ok) window.alert("error" in r ? String(r.error) : "denied" in r ? "Denied" : "Assign failed");
    void load();
  }

  async function onGrantDeny(kind: "grant" | "deny") {
    if (!ovKey.trim()) return;
    const fn = kind === "grant" ? authzGrantOverride : authzDenyOverride;
    const r = await fn({ targetUserId: userId, permissionKey: ovKey.trim(), reason: ovReason || null });
    if (!r.ok) window.alert("error" in r ? r.error : "denied");
    setOvKey("");
    setOvReason("");
    void load();
  }

  async function onRemoveOverride(id: string) {
    const r = await authzRemoveOverride({ overrideId: id, reason: "Removed from console" });
    if (!r.ok) window.alert("failed");
    void load();
  }

  async function onRemoveUserRole(userRoleId: string) {
    const r = await authzRemoveRole({ userRoleId, reason: "Removed from console" });
    if (!r.ok) window.alert("failed");
    void load();
  }

  async function onPrimary(userRoleId: string) {
    const r = await authzSetPrimaryRole({ userRoleId, reason: "Set primary from console" });
    if (!r.ok) window.alert("failed");
    void load();
  }

  async function onAddScope() {
    const r = await addUserScope({
      targetUserId: userId,
      scopeEntityType: scopeType,
      scopeEntityId: scopeEntityId || null,
      scopeCode: scopeCode || null,
      reason: "Scope add from console",
    });
    if (!r.ok) window.alert("error" in r ? r.error : "failed");
    const sc = await listUserScopesForUser(userId);
    setScopes(sc.ok ? sc.scopes : []);
  }

  async function onRemoveScope(id: string) {
    const r = await removeUserScope({ scopeId: id, reason: "Removed from console" });
    if (!r.ok) window.alert("failed");
    const sc = await listUserScopesForUser(userId);
    setScopes(sc.ok ? sc.scopes : []);
  }

  if (err && !bundle) {
    return <p className="text-sm text-amber-200">{err}</p>;
  }

  return (
    <div className="space-y-4">
      <header className="vendor-panel-soft rounded-2xl p-5">
        <div className="text-xs text-neutral-500">User access</div>
        <h1 className="mt-1 font-mono text-lg font-semibold text-white">{userId}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["overview", "roles", "overrides", "scope", "desks"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={[
                "rounded-lg px-3 py-1.5 text-xs font-semibold capitalize",
                tab === t ? "bg-teal-600 text-white" : "border border-white/15 bg-white/5 text-neutral-200 hover:bg-white/10",
              ].join(" ")}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      {tab === "overview" && snap ? (
        <section className="vendor-panel-soft grid gap-3 rounded-2xl p-5 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <div className="text-xs text-neutral-500">Granted permissions</div>
            <div className="mt-1 text-2xl font-semibold text-white">{summary?.granted ?? 0}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <div className="text-xs text-neutral-500">Denied overrides</div>
            <div className="mt-1 text-2xl font-semibold text-rose-200">{summary?.denied ?? 0}</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <div className="text-xs text-neutral-500">Accessible desks</div>
            <div className="mt-1 text-2xl font-semibold text-emerald-200">{summary?.desks ?? 0}</div>
          </div>
          <div className="sm:col-span-3 text-sm text-neutral-400">
            Primary role code: <span className="font-semibold text-neutral-200">{snap.primaryRoleCode ?? "—"}</span>
          </div>
        </section>
      ) : null}

      {tab === "roles" ? (
        <section className="vendor-panel-soft space-y-4 rounded-2xl p-5">
          <div className="flex flex-wrap items-end gap-2">
            <select value={assignRoleId} onChange={(e) => setAssignRoleId(e.target.value)} className="vendor-field rounded-lg px-3 py-2 text-sm">
              <option value="">Select role…</option>
              {rolesCatalog.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.role_code})
                </option>
              ))}
            </select>
            <button type="button" onClick={() => void onAssignRole()} className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white">
              Assign role
            </button>
          </div>
          <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
            {(bundle?.userRoles ?? []).map((ur: any) => (
              <li key={ur.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <div>
                  <span className="font-medium text-neutral-100">{ur.roles?.name ?? ur.role_id}</span>{" "}
                  <span className="font-mono text-xs text-neutral-500">{ur.roles?.role_code}</span>
                  {ur.is_primary ? <span className="ml-2 rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-100">Primary</span> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {!ur.is_primary ? (
                    <button type="button" className="text-xs text-teal-600 hover:underline" onClick={() => void onPrimary(ur.id)}>
                      Set primary
                    </button>
                  ) : null}
                  <button type="button" className="text-xs text-rose-300 hover:underline" onClick={() => void onRemoveUserRole(ur.id)}>
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === "overrides" ? (
        <section className="vendor-panel-soft space-y-4 rounded-2xl p-5">
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-100">
            Deny overrides beat role grants. Grant overrides add keys but scope rules from Pack 2 still apply.
          </div>
          <div className="flex flex-wrap gap-2">
            <input value={ovKey} onChange={(e) => setOvKey(e.target.value)} placeholder="permission_key" className="vendor-field flex-1 rounded-lg px-3 py-2 font-mono text-xs" />
            <input value={ovReason} onChange={(e) => setOvReason(e.target.value)} placeholder="Reason (critical overrides)" className="vendor-field flex-1 rounded-lg px-3 py-2 text-xs" />
            <button type="button" onClick={() => void onGrantDeny("grant")} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">
              Grant
            </button>
            <button type="button" onClick={() => void onGrantDeny("deny")} className="rounded-lg bg-rose-700 px-3 py-2 text-xs font-semibold text-white">
              Deny
            </button>
          </div>
          <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
            {(bundle?.overrides ?? []).map((o: any) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <div>
                  <span className="font-mono text-xs text-neutral-300">{o.permissions?.permission_key}</span>{" "}
                  <span className="text-xs text-neutral-500">{o.override_type}</span>
                </div>
                <button type="button" className="text-xs text-rose-300 hover:underline" onClick={() => void onRemoveOverride(o.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === "scope" ? (
        <section className="vendor-panel-soft space-y-4 rounded-2xl p-5">
          <div className="flex flex-wrap gap-2">
            <select value={scopeType} onChange={(e) => setScopeType(e.target.value as any)} className="vendor-field rounded-lg px-3 py-2 text-sm">
              <option value="tenant">tenant</option>
              <option value="branch">branch</option>
              <option value="warehouse">warehouse</option>
              <option value="terminal">terminal</option>
              <option value="desk">desk</option>
            </select>
            <input value={scopeEntityId} onChange={(e) => setScopeEntityId(e.target.value)} placeholder="scope_entity_id (uuid)" className="vendor-field rounded-lg px-3 py-2 font-mono text-xs" />
            <input value={scopeCode} onChange={(e) => setScopeCode(e.target.value)} placeholder="desk code (desk scope)" className="vendor-field rounded-lg px-3 py-2 font-mono text-xs" />
            <button type="button" onClick={() => void onAddScope()} className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white">
              Add scope
            </button>
          </div>
          <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
            {scopes.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="text-neutral-200">
                  {s.scope_entity_type} {s.scope_entity_id ? `· ${s.scope_entity_id}` : ""} {s.scope_code ? `· ${s.scope_code}` : ""}
                </span>
                <button type="button" className="text-xs text-rose-300 hover:underline" onClick={() => void onRemoveScope(s.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === "desks" && snap ? (
        <section className="vendor-panel-soft rounded-2xl p-5">
          <ul className="space-y-2">
            {DESK_CODES.map((code) => {
              const hit = snap.accessibleDesks?.find((d: any) => d.deskCode === code);
              const perm = DESK_PERMISSION_KEY_BY_CODE[code];
              return (
                <li key={code} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
                  <span className="text-neutral-200">{code.replace(/_/g, " ")}</span>
                  <span className={hit?.allowed ? "text-emerald-300" : "text-neutral-600"}>{hit?.allowed ? "Allowed" : "—"}</span>
                  <span className="font-mono text-[10px] text-neutral-500">{perm}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
