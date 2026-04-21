"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { rbacListTenantMembers } from "@/modules/authz/rbac-admin-actions";

export function UsersAccessListPage() {
  const [rows, setRows] = useState<Array<{ user_id: string; role: string }>>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const r = await rbacListTenantMembers();
      if (!r.ok) {
        setErr("error" in r ? String(r.error) : "denied" in r ? "Not authorized (requires system.users.manage)" : "Failed");
        setRows([]);
        return;
      }
      setErr(null);
      setRows(r.members ?? []);
    })();
  }, []);

  return (
    <section className="vendor-panel-soft rounded-2xl p-5">
      <h2 className="text-base font-semibold text-white">Workspace users</h2>
      <p className="mt-1 text-sm text-neutral-400">Supabase `tenant_members` — open a user to inspect RBAC roles, overrides, scopes, and desks.</p>
      {err ? <p className="mt-3 text-sm text-amber-200">{err}</p> : null}
      <ul className="mt-4 divide-y divide-white/10 rounded-xl border border-white/10">
        {rows.map((m) => (
          <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <div className="font-mono text-sm text-neutral-200">{m.user_id}</div>
              <div className="text-xs text-neutral-500">Membership role: {m.role}</div>
            </div>
            <Link
              href={`/dashboard/desk/security/users/${encodeURIComponent(m.user_id)}`}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
            >
              Open access
            </Link>
          </li>
        ))}
      </ul>
      {rows.length === 0 && !err ? <p className="mt-4 text-sm text-neutral-500">No members found.</p> : null}
    </section>
  );
}
