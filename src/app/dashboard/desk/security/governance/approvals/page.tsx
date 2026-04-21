import Link from "next/link";
import { SecurityConsoleLayout } from "@/modules/rbac-admin/ui/security-console-layout";
import { listMyPendingApprovals } from "@/modules/governance-approvals/approval-request.service";

export default async function GovernanceApprovalsPage() {
  const r = await listMyPendingApprovals();
  return (
    <SecurityConsoleLayout>
      <div className="space-y-4">
        <header className="vendor-panel-soft rounded-2xl p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">SysAdmin desk · Governance</div>
          <h2 className="mt-1 text-xl font-semibold text-white">Approval queue</h2>
          <p className="mt-2 text-sm text-neutral-400">Pending governed approvals tied to permission-sensitive actions.</p>
          <nav className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
            <Link href="/dashboard/desk/security/governance/approvals" className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white">
              Approvals
            </Link>
            <Link
              href="/dashboard/desk/security/governance/alerts"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10"
            >
              Alerts
            </Link>
            <Link
              href="/dashboard/desk/security/governance/recommendations"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10"
            >
              Recommendations
            </Link>
            <Link
              href="/dashboard/desk/security/governance/workflows"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10"
            >
              Workflows
            </Link>
            <Link
              href="/dashboard/desk/security/governance/reports"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10"
            >
              Reports
            </Link>
            <Link
              href="/dashboard/desk/security/governance/simulator"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10"
            >
              Policy simulator
            </Link>
            <Link
              href="/dashboard/desk/security/governance/policies"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10"
            >
              Policies
            </Link>
            <Link
              href="/dashboard/desk/security/governance/reviews"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10"
            >
              Reviews
            </Link>
            <Link
              href="/dashboard/desk/security/governance/archive"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10"
            >
              Archive
            </Link>
            <Link
              href="/dashboard/desk/security/governance/documents"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10"
            >
              Documents
            </Link>
            <Link
              href="/dashboard/desk/security/governance/external-events"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10"
            >
              External events
            </Link>
            <Link
              href="/dashboard/desk/security/governance/federation"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10"
            >
              Federation
            </Link>
            <Link
              href="/dashboard/desk/security/governance/overlays"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10"
            >
              Overlays
            </Link>
            <Link
              href="/dashboard/desk/security/governance/connectors"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10"
            >
              Regulator connectors
            </Link>
            <Link
              href="/dashboard/desk/security/governance/records"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10"
            >
              Records
            </Link>
            <Link
              href="/dashboard/desk/security/governance/ediscovery"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10"
            >
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
                  <th className="px-3 py-2">Policy</th>
                  <th className="px-3 py-2">Permission</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {r.rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-neutral-500">
                      No pending approvals.
                    </td>
                  </tr>
                ) : (
                  r.rows.map((x: any) => (
                    <tr key={x.id} className="border-b border-white/[0.06] last:border-0">
                      <td className="px-3 py-2 text-neutral-200">{x.approvalPolicyCode}</td>
                      <td className="px-3 py-2 font-mono text-xs text-neutral-300">{x.permissionKey}</td>
                      <td className="px-3 py-2 text-neutral-300">{x.status}</td>
                      <td className="px-3 py-2 text-neutral-500">{x.createdAt}</td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/dashboard/desk/security/governance/approvals/${x.id}`}
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

