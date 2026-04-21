import Link from "next/link";
import { SecurityConsoleLayout } from "@/modules/rbac-admin/ui/security-console-layout";
import { actOnRecommendation, generateGovernanceRecommendations, listRecommendations } from "@/modules/governance-recommendations/recommendations.service";

export default async function GovernanceRecommendationsPage() {
  const r = await listRecommendations();

  async function runGenerate() {
    "use server";
    await generateGovernanceRecommendations();
  }

  async function doAct(formData: FormData) {
    "use server";
    const recommendationId = String(formData.get("recommendationId") ?? "");
    const status = String(formData.get("status") ?? "") as any;
    const comment = String(formData.get("comment") ?? "");
    await actOnRecommendation({ recommendationId, status, comment });
  }

  return (
    <SecurityConsoleLayout>
      <div className="space-y-4">
        <header className="vendor-panel-soft rounded-2xl p-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">SysAdmin desk · Governance</div>
          <h2 className="mt-1 text-xl font-semibold text-white">Recommendations</h2>
          <p className="mt-2 text-sm text-neutral-400">Explainable suggestions based on governance signals (denials, overrides, approval patterns).</p>
          <nav className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
            <Link
              href="/dashboard/desk/security/governance/approvals"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10"
            >
              Approvals
            </Link>
            <Link
              href="/dashboard/desk/security/governance/alerts"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10"
            >
              Alerts
            </Link>
            <Link href="/dashboard/desk/security/governance/recommendations" className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white">
              Recommendations
            </Link>
            <Link
              href="/dashboard/desk/security/governance/workflows"
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10"
            >
              Workflows
            </Link>
            <form action={runGenerate}>
              <button className="rounded-lg border border-teal-500/40 bg-teal-500/10 px-3 py-2 text-sm font-semibold text-teal-100 hover:bg-teal-500/20">
                Run analysis
              </button>
            </form>
          </nav>
        </header>

        {!r.ok ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6 text-sm text-neutral-300">{r.error}</div>
        ) : r.rows.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6 text-sm text-neutral-400">No recommendations yet.</div>
        ) : (
          <div className="space-y-3">
            {r.rows.map((rec: any) => (
              <div key={rec.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  {rec.severity} · {rec.category} · {rec.recommendation_code} · status {rec.status}
                </div>
                <div className="mt-1 text-base font-semibold text-white">{rec.title}</div>
                <div className="mt-2 text-sm text-neutral-300">{rec.summary}</div>
                <div className="mt-3 text-xs text-neutral-500">Rationale: {rec.rationale}</div>
                <div className="mt-2 text-xs text-neutral-500">Suggested: {rec.suggested_action}</div>

                <form action={doAct} className="mt-4 flex flex-col gap-2">
                  <input type="hidden" name="recommendationId" value={rec.id} />
                  <input name="comment" placeholder="Comment (optional)" className="vendor-field rounded-lg px-3 py-2 text-xs text-white" />
                  <div className="flex flex-wrap gap-2">
                    <button name="status" value="accepted" className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
                      Accept
                    </button>
                    <button name="status" value="implemented" className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700">
                      Mark implemented
                    </button>
                    <button name="status" value="dismissed" className="rounded-lg bg-rose-600/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-600">
                      Dismiss
                    </button>
                  </div>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>
    </SecurityConsoleLayout>
  );
}

