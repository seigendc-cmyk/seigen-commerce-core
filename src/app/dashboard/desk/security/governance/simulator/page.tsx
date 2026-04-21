import Link from "next/link";
import { SecurityConsoleLayout } from "@/modules/rbac-admin/ui/security-console-layout";
import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";
import { authorizeForCurrentUser } from "@/modules/authz/authorization-guard";
import { runPolicySimulation } from "@/modules/governance-workflows/policy-simulation.service";

export default async function PolicySimulatorPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) {
    return (
      <SecurityConsoleLayout>
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6 text-sm text-neutral-300">Not signed in / no workspace.</div>
      </SecurityConsoleLayout>
    );
  }
  const can = await authorizeForCurrentUser({ permissionKey: "security.policy.manage" });
  const sp = await searchParams;
  const permissionKey = typeof sp.permissionKey === "string" ? sp.permissionKey : "pos.sale.void";
  const windowDays = Number(typeof sp.windowDays === "string" ? sp.windowDays : "7") || 7;
  const proposedRequiresApproval = typeof sp.proposedRequiresApproval === "string" ? sp.proposedRequiresApproval === "true" : true;

  const sim = can.allowed
    ? await runPolicySimulation({ kind: "require_approval_toggle", permissionKey, windowDays, proposedRequiresApproval }, ws.tenant.id)
    : ({ ok: false as const, error: "Not permitted" } as const);

  return (
    <SecurityConsoleLayout>
      <div className="space-y-4">
        <header className="vendor-panel-soft rounded-2xl p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">SysAdmin desk · Governance</div>
          <h2 className="mt-1 text-xl font-semibold text-white">Policy simulator</h2>
          <p className="mt-2 text-sm text-neutral-400">What-if analysis only. Does not mutate live policies.</p>
          <nav className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
            <Link href="/dashboard/desk/security/governance/reports" className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10">
              Reports
            </Link>
            <Link href="/dashboard/desk/security/governance/simulator" className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white">
              Policy simulator
            </Link>
          </nav>
        </header>

        <section className="vendor-panel-soft rounded-2xl p-6">
          <form className="grid gap-4 sm:grid-cols-3">
            <label className="block text-xs text-neutral-400 sm:col-span-2">
              <span className="mb-1 block font-medium text-neutral-300">Permission key</span>
              <input name="permissionKey" defaultValue={permissionKey} className="vendor-field w-full rounded-lg px-3 py-2 text-sm text-white" />
            </label>
            <label className="block text-xs text-neutral-400">
              <span className="mb-1 block font-medium text-neutral-300">Window (days)</span>
              <input name="windowDays" defaultValue={String(windowDays)} type="number" min={1} max={90} className="vendor-field w-full rounded-lg px-3 py-2 text-sm text-white" />
            </label>
            <label className="block text-xs text-neutral-400 sm:col-span-3">
              <span className="mb-1 block font-medium text-neutral-300">Proposed: requires approval</span>
              <select name="proposedRequiresApproval" defaultValue={String(proposedRequiresApproval)} className="vendor-field w-full rounded-lg px-3 py-2 text-sm text-white">
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </label>
            <div className="sm:col-span-3">
              <button className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">Run simulation</button>
            </div>
          </form>
        </section>

        {!sim.ok ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6 text-sm text-neutral-300">{sim.error}</div>
        ) : (
          <section className="vendor-panel-soft rounded-2xl p-6">
            <h3 className="text-base font-semibold text-white">Result</h3>
            <pre className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-neutral-200">
              {JSON.stringify(sim.result, null, 2)}
            </pre>
          </section>
        )}
      </div>
    </SecurityConsoleLayout>
  );
}

