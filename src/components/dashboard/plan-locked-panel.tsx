import Link from "next/link";
import { DashboardTopBar } from "@/components/dashboard/dashboard-top-bar";
import type { DashboardProductArea } from "@/lib/local-plan-gates";
import { DASHBOARD_AREA_GATES } from "@/lib/local-plan-gates";
import { getPlanById, PLAN_MODULE_INFO, type PlanId } from "@/lib/plans";

type Props = {
  area: DashboardProductArea;
  planId: PlanId | null;
};

export function PlanLockedPanel({ area, planId }: Props) {
  const spec = DASHBOARD_AREA_GATES[area];
  const plan = planId ? getPlanById(planId) : undefined;

  return (
    <>
      <DashboardTopBar title={spec.title} subtitle="Not available on your current plan" />
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
        <div className="max-w-md rounded-2xl border border-amber-500/30 bg-amber-950/20 p-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-200/90">Plan limit</p>
          <h2 className="mt-3 text-lg font-semibold text-white">Not included in your current plan</h2>
          <p className="mt-2 text-sm text-neutral-300">{spec.description}</p>
          {plan ? (
            <p className="mt-4 text-sm text-neutral-300">
              You are on <span className="font-semibold text-white">{plan.name}</span>. Upgrade your packaging to
              unlock {spec.shortLabel.toLowerCase()}.
            </p>
          ) : null}
          <ul className="mt-4 space-y-1 text-left text-xs text-neutral-400">
            {spec.requiredModules.map((m) => (
              <li key={m}>
                Requires plan module: <span className="font-medium text-neutral-300">{PLAN_MODULE_INFO[m].label}</span>{" "}
                ({m})
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link
              href="/plans"
              className="inline-flex justify-center rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
            >
              View plans and upgrade
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex justify-center rounded-lg border border-white/20 px-4 py-2.5 text-sm font-semibold text-white hover:border-teal-500 hover:text-teal-600"
            >
              Back to overview
            </Link>
          </div>
          <p className="mt-6 text-[11px] text-neutral-500">
            Local demo only: enforcement is in this browser. Production will use account entitlements from your
            backend.
          </p>
        </div>
      </div>
    </>
  );
}
