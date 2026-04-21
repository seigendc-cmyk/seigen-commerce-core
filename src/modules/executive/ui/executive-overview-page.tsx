"use client";

import { useEffect, useMemo, useState } from "react";
import { PLAN_MODULE_INFO, modulesMissingFromPlan } from "@/lib/plans";
import { DEMO_WORKSPACE_STATUS_COPY } from "@/lib/demo-session";
import { posSalesStorageKey } from "@/modules/pos/services/sales-service";
import { inventoryKeys } from "@/modules/inventory/services/inventory-repo";
import type { ExecutiveSnapshot } from "../types/executive";
import { readExecutiveSnapshot } from "../services/executive-snapshot";
import { ExecutiveTopBar } from "./executive-top-bar";

function money(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function ExecutiveOverviewPage() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key === posSalesStorageKey || e.key === inventoryKeys.db) {
        setTick((t) => t + 1);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const snap: ExecutiveSnapshot = useMemo(() => {
    void tick;
    return readExecutiveSnapshot();
  }, [tick]);

  const businessName = snap.demoSession?.businessName ?? "No active demo session";
  const planLabel = snap.plan
    ? `${snap.plan.name} (${snap.plan.monthlyPriceLabel}/mo)`
    : snap.demoSession
      ? `Unknown plan (${snap.demoSession.planId})`
      : "—";

  const missing = useMemo(() => (snap.plan ? modulesMissingFromPlan(snap.plan) : []), [snap.plan]);

  return (
    <>
      <ExecutiveTopBar
        title="Executive visibility"
        subtitle="Ownership view across commercial posture, inventory health, and POS activity — aggregated locally."
      />

      <div className="flex-1 space-y-8 px-4 py-8 sm:px-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="executive-panel rounded-2xl p-5">
            <p className="text-xs font-semibold text-neutral-400">Workspace</p>
            <p className="mt-2 text-lg font-semibold text-white">{businessName}</p>
            <p className="mt-1 text-sm text-neutral-300">
              {snap.demoSession
                ? DEMO_WORKSPACE_STATUS_COPY[snap.demoSession.workspaceStatus]
                : "Sign in / sign up to create a local demo workspace."}
            </p>
          </div>

          <div className="executive-panel rounded-2xl p-5">
            <p className="text-xs font-semibold text-neutral-400">Commercial position</p>
            <p className="mt-2 text-lg font-semibold text-white">{planLabel}</p>
            <p className="mt-1 text-sm text-neutral-300">
              Included modules: <span className="text-neutral-200">{snap.commercial.includedModules.length}</span>
              {snap.plan ? (
                <>
                  {" "}
                  · Not included: <span className="text-neutral-200">{missing.length}</span>
                </>
              ) : null}
            </p>
          </div>

          <div className="executive-panel rounded-2xl p-5">
            <p className="text-xs font-semibold text-neutral-400">POS activity</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <p className="text-2xl font-semibold text-white">{snap.pos.totalSalesCount}</p>
                <p className="text-xs text-neutral-400">Local receipts</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold text-white">{money(snap.pos.totalSalesValue)}</p>
                <p className="text-xs text-neutral-400">Sales value (subtotal)</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-neutral-300">
              Latest receipt:{" "}
              <span className="font-mono text-teal-600">{snap.pos.latestReceiptNumber ?? "—"}</span>
            </p>
          </div>

          <div className="executive-panel-soft rounded-2xl p-5">
            <p className="text-xs font-semibold text-neutral-400">Inventory status</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <p className="text-2xl font-semibold text-white">{snap.inventory.totalProducts}</p>
                <p className="text-xs text-neutral-400">Products</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold text-white">{snap.inventory.totalStockOnHand}</p>
                <p className="text-xs text-neutral-400">Units on hand</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-neutral-500">
              Stock is derived from local receiving records for the default branch.
            </p>
          </div>

          <div className="executive-panel-soft rounded-2xl p-5 md:col-span-2">
            <p className="text-xs font-semibold text-neutral-400">Signal integrity</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-semibold text-white">Data sources</p>
                <p className="mt-1 text-sm text-neutral-300">
                  Demo session (sessionStorage), POS receipts (localStorage), inventory catalog + stock (localStorage).
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm font-semibold text-white">Refresh model</p>
                <p className="mt-1 text-sm text-neutral-300">
                  Auto-refresh on storage changes across tabs; current tab updates on relevant writes.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="executive-panel rounded-2xl p-6 lg:col-span-2">
            <h2 className="text-base font-semibold text-white">Commercial position</h2>
            <p className="mt-1 text-sm text-neutral-300">
              Current plan, module footprint, and what governance can expect from the workspace today.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs font-semibold text-neutral-400">Included modules</p>
                {snap.plan ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {snap.plan.includedModules.map((m) => (
                      <span
                        key={m}
                        className="rounded-full border border-teal-500/30 bg-teal-600/10 px-2.5 py-1 text-xs font-semibold text-neutral-100"
                        title={PLAN_MODULE_INFO[m]?.blurb ?? m}
                      >
                        {PLAN_MODULE_INFO[m]?.label ?? m}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-neutral-300">No plan selected yet.</p>
                )}
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs font-semibold text-neutral-400">Not included (visibility)</p>
                {snap.plan ? (
                  missing.length === 0 ? (
                    <p className="mt-2 text-sm text-neutral-300">All modules included.</p>
                  ) : (
                    <ul className="mt-2 space-y-1 text-sm text-neutral-300">
                      {missing.slice(0, 6).map((m) => (
                        <li key={m}>
                          <span className="text-neutral-200">{PLAN_MODULE_INFO[m]?.label ?? m}</span>{" "}
                          <span className="text-neutral-500">— {PLAN_MODULE_INFO[m]?.blurb ?? ""}</span>
                        </li>
                      ))}
                      {missing.length > 6 ? (
                        <li className="text-neutral-500">+ {missing.length - 6} more…</li>
                      ) : null}
                    </ul>
                  )
                ) : (
                  <p className="mt-2 text-sm text-neutral-300">Select a plan in onboarding to populate this view.</p>
                )}
              </div>
            </div>
          </div>

          <div className="executive-panel-soft rounded-2xl p-6">
            <h2 className="text-base font-semibold text-white">Platform readiness notes</h2>
            <p className="mt-1 text-sm text-neutral-300">What is real today, and what becomes real with a backend.</p>
            <ul className="mt-4 space-y-3">
              {snap.readinessNotes.map((n) => (
                <li key={n.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white">{n.title}</p>
                    <span
                      className={[
                        "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                        n.status === "real"
                          ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200"
                          : "border-amber-500/35 bg-amber-500/10 text-amber-200",
                      ].join(" ")}
                    >
                      {n.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-neutral-300">{n.detail}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="executive-panel rounded-2xl p-6">
            <h2 className="text-base font-semibold text-white">Inventory status</h2>
            <p className="mt-1 text-sm text-neutral-300">
              Governance summary of the catalog footprint and on-hand position in the default branch.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs font-semibold text-neutral-400">Products</p>
                <p className="mt-2 text-2xl font-semibold text-white">{snap.inventory.totalProducts}</p>
                <p className="mt-1 text-sm text-neutral-400">Active + inactive catalog items (local).</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs font-semibold text-neutral-400">Units on hand</p>
                <p className="mt-2 text-2xl font-semibold text-white">{snap.inventory.totalStockOnHand}</p>
                <p className="mt-1 text-sm text-neutral-400">Sum of on-hand quantities (default branch).</p>
              </div>
            </div>
          </div>

          <div className="executive-panel rounded-2xl p-6">
            <h2 className="text-base font-semibold text-white">POS activity</h2>
            <p className="mt-1 text-sm text-neutral-300">
              Operational visibility across local receipts recorded in this browser.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs font-semibold text-neutral-400">Receipts</p>
                <p className="mt-2 text-2xl font-semibold text-white">{snap.pos.totalSalesCount}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:col-span-2">
                <p className="text-xs font-semibold text-neutral-400">Sales value (subtotal)</p>
                <p className="mt-2 text-2xl font-semibold text-white">{money(snap.pos.totalSalesValue)}</p>
                <p className="mt-1 text-sm text-neutral-400">
                  Latest receipt:{" "}
                  <span className="font-mono text-teal-600">{snap.pos.latestReceiptNumber ?? "—"}</span>
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

