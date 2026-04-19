import { Section } from "@/components/marketing/section";
import { PlanWorkspaceCta } from "@/components/plans/plan-workspace-cta";
import { PLANS } from "@/lib/plans";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getDashboardWorkspace } from "@/lib/workspace/server";

export const metadata = { title: "Plans" };

export default async function PlansPage() {
  const workspace = isSupabaseConfigured() ? await getDashboardWorkspace() : null;
  const canManagePlan = Boolean(workspace?.tenant && workspace.user);

  return (
    <Section
      title="Plans built for how you sell"
      subtitle={
        canManagePlan
          ? "Choose a tier for your workspace — included modules turn on as soon as you apply a plan."
          : "Pick the footprint that matches your stores, channels, and wholesale motion. Your choice is saved in this browser and carried through signup."
      }
    >
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {PLANS.map((plan) => (
          <article
            key={plan.id}
            className={[
              "flex flex-col rounded-2xl border p-6 shadow-sm transition-shadow",
              plan.featured
                ? "border-brand-orange bg-white shadow-md ring-1 ring-brand-orange/40"
                : "border-neutral-200 bg-white hover:border-neutral-300",
            ].join(" ")}
          >
            {plan.featured ? (
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-orange">
                Popular with growing retailers
              </p>
            ) : (
              <div className="mb-2 h-4" aria-hidden />
            )}
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h3 className="text-lg font-semibold text-neutral-900">{plan.name}</h3>
              <p className="text-2xl font-bold tabular-nums text-neutral-900">
                {plan.monthlyPriceLabel}
                {plan.monthlyPriceLabel !== "Custom" ? (
                  <span className="text-sm font-medium text-neutral-500">/mo</span>
                ) : null}
              </p>
            </div>
            <p className="mt-3 text-sm font-medium text-neutral-800">{plan.purpose}</p>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">{plan.tagline}</p>

            <div className="mt-4 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
              <p className="font-semibold uppercase tracking-wide text-neutral-500">Best for</p>
              <p className="mt-1 leading-snug">{plan.audience}</p>
            </div>

            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Included highlights
            </p>
            <ul className="mt-2 flex-1 space-y-2 text-sm text-neutral-700">
              {plan.highlights.map((h) => (
                <li key={h} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-orange" aria-hidden />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
            <PlanWorkspaceCta
              planId={plan.id}
              planName={plan.name}
              cta={plan.cta}
              canManagePlan={canManagePlan}
            />
          </article>
        ))}
      </div>
    </Section>
  );
}
