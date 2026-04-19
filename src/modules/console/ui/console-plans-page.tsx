"use client";

import { ConsoleTopBar } from "./console-top-bar";
import { PLAN_MODULE_INFO, PLANS } from "@/lib/plans";

export function ConsolePlansPage() {
  return (
    <>
      <ConsoleTopBar
        title="Plans"
        subtitle="Read-only view of the local plans catalog. Editing and overrides will land here in later phases."
      />
      <div className="flex-1 space-y-6 px-4 py-6 sm:px-6">
        <section className="vendor-panel rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white">Plan catalog</h2>
          <p className="mt-1 text-sm text-neutral-300">
            These are the same plans used by `/plans` and local vendor onboarding.
          </p>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          {PLANS.map((p) => (
            <article key={p.id} className="vendor-panel-soft rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{p.id}</p>
                  <h3 className="mt-1 text-base font-semibold text-white">{p.name}</h3>
                  <p className="mt-2 text-sm text-neutral-300">{p.purpose}</p>
                  <p className="mt-1 text-sm text-neutral-300">{p.audience}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold tabular-nums text-white">
                    {p.monthlyPriceLabel}
                    {p.monthlyPriceLabel !== "Custom" ? (
                      <span className="text-sm font-medium text-neutral-400">/mo</span>
                    ) : null}
                  </p>
                  {p.featured ? (
                    <span className="mt-2 inline-flex rounded bg-brand-orange/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-orange">
                      Featured
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 border-t border-white/10 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Included modules</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {p.includedModules.map((m) => (
                    <li
                      key={m}
                      className="rounded border border-white/10 bg-brand-charcoal/40 px-2 py-1 text-xs text-neutral-200"
                      title={PLAN_MODULE_INFO[m].blurb}
                    >
                      {PLAN_MODULE_INFO[m].label}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}

