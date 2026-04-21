import Link from "next/link";
import { SecurityConsoleLayout } from "@/modules/rbac-admin/ui/security-console-layout";
import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";
import { authorizeForCurrentUser } from "@/modules/authz/authorization-guard";
import { listWorkflows } from "@/modules/governance-workflows/workflow-instance.service";

export default async function GovernanceWorkflowsPage() {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) {
    return (
      <SecurityConsoleLayout>
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6 text-sm text-neutral-300">Not signed in / no workspace.</div>
      </SecurityConsoleLayout>
    );
  }

  const can = await authorizeForCurrentUser({ permissionKey: "approval.history.view" });
  const rows = can.allowed ? await listWorkflows(ws.tenant.id) : [];

  return (
    <SecurityConsoleLayout>
      <div className="space-y-4">
        <header className="vendor-panel-soft rounded-2xl p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">SysAdmin desk · Governance</div>
          <h2 className="mt-1 text-xl font-semibold text-white">Workflow inbox</h2>
          <p className="mt-2 text-sm text-neutral-400">Cross-module governance workflows (approvals + step-up + execution + alerts) with a unified timeline.</p>
          <nav className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
            <Link href="/dashboard/desk/security/governance/approvals" className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10">
              Approvals
            </Link>
            <Link href="/dashboard/desk/security/governance/workflows" className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white">
              Workflows
            </Link>
            <Link href="/dashboard/desk/security/governance/alerts" className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10">
              Alerts
            </Link>
            <Link
              href="/dashboard/desk/security/governance/recommendations"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10"
            >
              Recommendations
            </Link>
          </nav>
        </header>

        {!can.allowed ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6 text-sm text-neutral-300">Not permitted.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.04] text-xs font-semibold uppercase tracking-wide text-neutral-400">
                <tr>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Risk</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Origin</th>
                  <th className="px-3 py-2">Visibility</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-neutral-500">
                      No workflows yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((w) => (
                    <tr key={w.id} className="border-b border-white/[0.06] last:border-0">
                      <td className="px-3 py-2 text-neutral-200">{w.title}</td>
                      <td className="px-3 py-2 text-neutral-300">{w.riskLevel}</td>
                      <td className="px-3 py-2 text-neutral-300">{w.status}</td>
                      <td className="px-3 py-2 font-mono text-xs text-neutral-400">{w.originPermissionKey}</td>
                      <td className="px-3 py-2 text-neutral-400">
                        {w.executiveVisible ? "Exec" : "—"} {w.trustVisible ? "· Trust" : ""}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/dashboard/desk/security/governance/workflows/${w.id}`}
                          className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </SecurityConsoleLayout>
  );
}

