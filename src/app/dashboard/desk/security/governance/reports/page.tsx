import Link from "next/link";
import { SecurityConsoleLayout } from "@/modules/rbac-admin/ui/security-console-layout";
import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";
import { authorizeForCurrentUser } from "@/modules/authz/authorization-guard";
import { exportWorkflowsCsv } from "@/modules/governance-workflows/workflow-export.service";

export default async function GovernanceReportsPage() {
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
  const csv = can.allowed ? await exportWorkflowsCsv({ tenantId: ws.tenant.id, limit: 500 }) : { ok: false as const, error: "Not permitted" };

  return (
    <SecurityConsoleLayout>
      <div className="space-y-4">
        <header className="vendor-panel-soft rounded-2xl p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">SysAdmin desk · Governance</div>
          <h2 className="mt-1 text-xl font-semibold text-white">Governance reports</h2>
          <p className="mt-2 text-sm text-neutral-400">Exportable workflow activity for enterprise governance review.</p>
          <nav className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
            <Link href="/dashboard/desk/security/governance/workflows" className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10">
              Workflows
            </Link>
            <Link href="/dashboard/desk/security/governance/reports" className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white">
              Reports
            </Link>
            <Link href="/dashboard/desk/security/governance/simulator" className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10">
              Policy simulator
            </Link>
          </nav>
        </header>

        {!csv.ok ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6 text-sm text-neutral-300">{csv.error}</div>
        ) : (
          <section className="vendor-panel-soft rounded-2xl p-6">
            <h3 className="text-base font-semibold text-white">Workflow CSV export</h3>
            <p className="mt-2 text-sm text-neutral-400">Copy or download from your browser.</p>
            <textarea className="mt-4 h-[360px] w-full rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-xs text-neutral-200" readOnly value={csv.csv} />
          </section>
        )}
      </div>
    </SecurityConsoleLayout>
  );
}

