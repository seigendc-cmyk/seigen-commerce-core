import Link from "next/link";
import { SecurityConsoleLayout } from "@/modules/rbac-admin/ui/security-console-layout";
import { listFederationScopes } from "@/modules/governance-federation/federation-scope.service";
import { GovernanceCopilotPanel } from "@/components/governance/copilot-panel";

export default async function FederationConsolePage() {
  const r = await listFederationScopes();
  return (
    <SecurityConsoleLayout>
      <div className="space-y-4">
        <header className="vendor-panel-soft rounded-2xl p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">SysAdmin desk · Governance</div>
          <h2 className="mt-1 text-xl font-semibold text-white">Federation policy console</h2>
          <p className="mt-2 text-sm text-neutral-400">Scopes and overlays resolve deterministically by specificity and priority.</p>
          <nav className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
            <Link href="/dashboard/desk/security/governance/approvals" className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10">
              Approvals
            </Link>
            <Link href="/dashboard/desk/security/governance/federation" className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white">
              Federation
            </Link>
            <Link href="/dashboard/desk/security/governance/overlays" className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10">
              Overlays
            </Link>
            <Link href="/dashboard/desk/security/governance/connectors" className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10">
              Regulator connectors
            </Link>
            <Link href="/dashboard/desk/security/governance/records" className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10">
              Records
            </Link>
            <Link href="/dashboard/desk/security/governance/ediscovery" className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10">
              E-Discovery
            </Link>
          </nav>
        </header>

        {!r.ok ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6 text-sm text-neutral-300">{r.error}</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.04] text-xs font-semibold uppercase tracking-wide text-neutral-400">
                <tr>
                  <th className="px-3 py-2">Scope</th>
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Parent</th>
                  <th className="px-3 py-2">Visibility</th>
                </tr>
              </thead>
              <tbody>
                {r.rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-neutral-500">
                      No federation scopes yet.
                    </td>
                  </tr>
                ) : (
                  r.rows.map((s) => (
                    <tr key={s.id} className="border-b border-white/[0.06] last:border-0">
                      <td className="px-3 py-2 font-mono text-xs text-neutral-300">{s.scopeType}</td>
                      <td className="px-3 py-2 font-mono text-xs text-neutral-300">{s.scopeCode}</td>
                      <td className="px-3 py-2 text-neutral-200">{s.title}</td>
                      <td className="px-3 py-2 text-neutral-500">{s.parentScopeId ? s.parentScopeId.slice(-8) : "—"}</td>
                      <td className="px-3 py-2 text-neutral-500">{s.isPublic ? "public" : s.tenantId ? "tenant" : "system"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <GovernanceCopilotPanel />
      </div>
    </SecurityConsoleLayout>
  );
}

