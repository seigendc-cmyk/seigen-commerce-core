import Link from "next/link";
import { SecurityConsoleLayout } from "@/modules/rbac-admin/ui/security-console-layout";
import { listPolicies } from "@/modules/policy-lifecycle/policy-version.service";
import { listPolicyOverlays, publishPolicyOverlay } from "@/modules/policy-overlay/overlay-registry.service";

export default async function OverlayManagementPage() {
  const [pol, ovs] = await Promise.all([listPolicies(), listPolicyOverlays({ limit: 200 })]);
  return (
    <SecurityConsoleLayout>
      <div className="space-y-4">
        <header className="vendor-panel-soft rounded-2xl p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">SysAdmin desk · Governance</div>
          <h2 className="mt-1 text-xl font-semibold text-white">Policy overlays</h2>
          <p className="mt-2 text-sm text-neutral-400">Regional/country/tenant/branch overlays that merge into the effective policy.</p>
          <nav className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
            <Link href="/dashboard/desk/security/governance/federation" className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10">
              Federation
            </Link>
            <Link href="/dashboard/desk/security/governance/overlays" className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white">
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

        {!ovs.ok ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6 text-sm text-neutral-300">{ovs.error}</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[1060px] text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.04] text-xs font-semibold uppercase tracking-wide text-neutral-400">
                <tr>
                  <th className="px-3 py-2">Overlay</th>
                  <th className="px-3 py-2">Base policy</th>
                  <th className="px-3 py-2">Scope</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Priority</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {ovs.rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-neutral-500">
                      No overlays yet.
                    </td>
                  </tr>
                ) : (
                  ovs.rows.map((o) => (
                    <tr key={o.id} className="border-b border-white/[0.06] last:border-0">
                      <td className="px-3 py-2 text-neutral-200">{o.overlayCode}</td>
                      <td className="px-3 py-2 text-neutral-400">
                        {pol.ok ? pol.rows.find((p) => p.id === o.basePolicyId)?.policyCode ?? o.basePolicyId.slice(-8) : o.basePolicyId.slice(-8)}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-neutral-300">
                        {o.overlayScopeType}:{o.overlayScopeId.slice(-8)}
                      </td>
                      <td className="px-3 py-2 text-neutral-300">{o.status}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-neutral-300">{o.priorityRank}</td>
                      <td className="px-3 py-2 text-right">
                        {o.status === "draft" || o.status === "approved" ? (
                          <form
                            action={async () => {
                              "use server";
                              await publishPolicyOverlay({ overlayId: o.id });
                            }}
                          >
                            <button className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-neutral-950">Publish</button>
                          </form>
                        ) : (
                          <span className="text-xs text-neutral-500">—</span>
                        )}
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

