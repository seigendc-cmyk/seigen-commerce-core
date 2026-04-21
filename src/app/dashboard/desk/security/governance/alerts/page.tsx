import Link from "next/link";
import { SecurityConsoleLayout } from "@/modules/rbac-admin/ui/security-console-layout";
import { actOnAlert, listAlerts } from "@/modules/governance-alerts/governance-alerts.service";

export default async function GovernanceAlertsPage() {
  const r = await listAlerts();
  async function doAct(formData: FormData) {
    "use server";
    const alertId = String(formData.get("alertId") ?? "");
    const action = String(formData.get("action") ?? "") as any;
    const comment = String(formData.get("comment") ?? "");
    await actOnAlert({ alertId, action, comment });
  }

  return (
    <SecurityConsoleLayout>
      <div className="space-y-4">
        <header className="vendor-panel-soft rounded-2xl p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">SysAdmin desk · Governance</div>
          <h2 className="mt-1 text-xl font-semibold text-white">Governance alerts</h2>
          <nav className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
            <Link
              href="/dashboard/desk/security/governance/approvals"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10"
            >
              Approvals
            </Link>
            <Link href="/dashboard/desk/security/governance/alerts" className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white">
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
          </nav>
        </header>

        {!r.ok ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6 text-sm text-neutral-300">{r.error}</div>
        ) : (
          <div className="space-y-3">
            {r.rows.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6 text-sm text-neutral-400">No alerts.</div>
            ) : (
              r.rows.map((a: any) => (
                <div key={a.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{a.severity} · {a.alert_code}</div>
                      <div className="mt-1 text-base font-semibold text-white">{a.title}</div>
                      <div className="mt-2 text-sm text-neutral-300">{a.summary}</div>
                      <div className="mt-2 text-xs text-neutral-500">{a.created_at} · status {a.status}</div>
                    </div>
                    <form action={doAct} className="flex flex-col gap-2">
                      <input type="hidden" name="alertId" value={a.id} />
                      <input name="comment" placeholder="Comment (optional)" className="vendor-field rounded-lg px-3 py-2 text-xs text-white" />
                      <div className="flex gap-2">
                        <button name="action" value="acknowledge" className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15">
                          Acknowledge
                        </button>
                        <button name="action" value="resolve" className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
                          Resolve
                        </button>
                        <button name="action" value="dismiss" className="rounded-lg bg-rose-600/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-600">
                          Dismiss
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </SecurityConsoleLayout>
  );
}

