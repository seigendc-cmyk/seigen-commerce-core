"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DashboardTopBar } from "@/components/dashboard/dashboard-top-bar";
import { useWorkspace } from "@/components/dashboard/workspace-context";
import type { DemoVendorSession } from "@/lib/demo-session";
import { DEMO_WORKSPACE_STATUS_COPY, readDemoSession } from "@/lib/demo-session";
import type { DashboardProductArea } from "@/lib/local-plan-gates";
import { planAllowsDashboardArea } from "@/lib/local-plan-gates";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getPlanById, modulesMissingFromPlan, PLAN_MODULE_INFO, type PlanModule } from "@/lib/plans";

type HubCard =
  | {
      kind: "area";
      area: DashboardProductArea;
      title: string;
      body: string;
      href: string;
    }
  | {
      kind: "bundle";
      title: string;
      body: string;
      href: string;
      anyModule: PlanModule[];
    };

const HUB_CARDS: HubCard[] = [
  {
    kind: "area",
    area: "inventory",
    title: "Inventory & catalog",
    body: "Products, stock, receiving, and purchasing for your default branch.",
    href: "/dashboard/inventory",
  },
  {
    kind: "area",
    area: "pos",
    title: "Point of sale",
    body: "Registers, cart, tenders, receipts, and local sales history.",
    href: "/dashboard/pos",
  },
  {
    kind: "area",
    area: "cashplan",
    title: "CashPlan",
    body: "What you owe suppliers, what debtors owe you, and goods on laybye — in one workspace view.",
    href: "/dashboard/cash-plan",
  },
  {
    kind: "bundle",
    title: "Commerce & growth",
    body: "Storefront, promotions, APIs, and advanced capabilities as your plan allows.",
    href: "/plans",
    anyModule: ["online_storefront", "promotions", "api_integrations", "multi_branch", "wholesale_b2b"],
  },
];

function formatSessionWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function subscriptionStatusLabel(status: string | undefined) {
  switch (status) {
    case "active":
      return "Active";
    case "pending_activation":
      return "Pending activation (billing)";
    case "inactive":
      return "Inactive";
    case "cancelled":
      return "Cancelled";
    default:
      return status ?? "—";
  }
}

export function DashboardClient() {
  const workspace = useWorkspace();
  const [demo, setDemo] = useState<DemoVendorSession | null>(null);

  useEffect(() => {
    setDemo(readDemoSession());
  }, [workspace?.subscription?.plan_id, workspace?.tenant?.id]);

  const effectivePlanId = workspace?.subscription?.plan_id ?? demo?.planId ?? null;
  const plan = useMemo(() => (effectivePlanId ? getPlanById(effectivePlanId) : undefined), [effectivePlanId]);
  const missingModules = useMemo(() => (plan ? modulesMissingFromPlan(plan) : []), [plan]);

  const welcomeName =
    workspace?.tenant?.name ?? demo?.businessName ?? workspace?.user?.email ?? "Vendor workspace";

  const hasSurface = Boolean(workspace?.user) || demo !== null;

  if (!hasSurface) {
    return (
      <>
        <DashboardTopBar
          title="Vendor dashboard"
          subtitle={
            isSupabaseConfigured()
              ? "Sign in with Supabase to load your workspace, or use local-only demo when auth is off."
              : "Sign up or sign in to load your workspace (Supabase not configured — local demo only)."
          }
        />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
          <p className="max-w-md text-sm text-neutral-700">
            No active session in this tab. Complete onboarding or sign in to open the vendor shell.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/plans"
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
            >
              View plans
            </Link>
            <Link href="/signin" className="vendor-btn-secondary-wash px-4 py-2">
              Sign in
            </Link>
          </div>
        </div>
      </>
    );
  }

  const subtitleParts: string[] = [];
  if (plan) {
    subtitleParts.push(
      `${plan.name} · ${plan.monthlyPriceLabel}${plan.monthlyPriceLabel !== "Custom" ? "/mo" : ""}`,
    );
  }
  if (workspace?.subscription) {
    subtitleParts.push(`Subscription: ${subscriptionStatusLabel(workspace.subscription.status)}`);
  }
  if (workspace?.user) {
    subtitleParts.push("Identity: Supabase");
  } else {
    subtitleParts.push("Identity: local demo session");
  }
  if (demo && workspace?.user) {
    subtitleParts.push("Inventory/POS: local-first (unchanged)");
  }

  return (
    <>
      <DashboardTopBar title={`Welcome, ${welcomeName}`} subtitle={subtitleParts.join(" · ")} />
      <div className="flex-1 space-y-8 px-4 py-8 sm:px-6">
        {workspace?.user && !workspace.tenant ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm">
            Your account is signed in, but no workspace row was found yet. If you just confirmed email, wait a
            moment — we retry provisioning automatically. You can also complete signup again from{" "}
            <Link href="/signup" className="font-semibold text-amber-900 underline underline-offset-2">
              Sign up
            </Link>
            .
          </div>
        ) : null}

        <section className="vc-dashboard-command-hero">
          <div className="vc-dashboard-command-hero-inner">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-400/95">Vendor Core</p>
            <h2 className="font-heading mt-2 max-w-2xl text-2xl font-bold tracking-tight text-white sm:text-3xl">
              One workspace. Total operational visibility.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-400">
              Run stock, sales, staff, and governance from a single disciplined command center—local-first today,
              tenant-aware as you connect services.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/dashboard/inventory" className="vc-btn-momentum">
                Open inventory
              </Link>
              <Link
                href="/dashboard/settings"
                className="inline-flex items-center justify-center rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:border-white/35 hover:bg-white/10"
              >
                Workspace settings
              </Link>
            </div>
          </div>
        </section>

        <section className="vc-hero-banner">
          <div className="vc-hero-banner-inner">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-heading text-lg font-semibold tracking-tight text-white">
                  Current plan (commercial truth)
                </h2>
                <p className="mt-1 text-sm text-slate-300">{plan?.purpose ?? effectivePlanId ?? "—"}</p>
                {workspace?.subscription ? (
                  <p className="mt-3 text-xs text-slate-400">
                    Backend status:{" "}
                    <span className="font-medium text-slate-200">
                      {subscriptionStatusLabel(workspace.subscription.status)}
                    </span>
                    {workspace.subscription.status === "pending_activation" ? (
                      <span className="text-slate-500">
                        {" "}
                        — entitlements follow this plan; only billing confirmation may still be pending.
                      </span>
                    ) : null}
                  </p>
                ) : (
                  <p className="mt-3 text-xs text-slate-400">
                    No Supabase subscription row yet — using local session for module gating until provisioned.
                  </p>
                )}
                {demo ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Local bridge: {DEMO_WORKSPACE_STATUS_COPY[demo.workspaceStatus]}
                  </p>
                ) : null}
              </div>
              <div className="text-right">
                <p className="font-mono text-2xl font-bold tabular-nums text-white">
                  {plan?.monthlyPriceLabel ?? "—"}
                  {plan && plan.monthlyPriceLabel !== "Custom" ? (
                    <span className="ml-1 font-sans text-sm font-medium text-slate-400">/mo</span>
                  ) : null}
                </p>
                <Link
                  href="/plans"
                  className="mt-2 inline-block text-sm font-semibold text-teal-300 hover:text-teal-200 hover:underline"
                >
                  Compare or change plan
                </Link>
              </div>
            </div>
            <div className="mt-6 grid gap-6 border-t border-white/10 pt-6 lg:grid-cols-2">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Included in your plan
                </h3>
                <ul className="mt-3 space-y-2 text-sm text-slate-200">
                  {plan?.includedModules.map((m) => (
                    <li key={m} className="flex gap-2">
                      <span className="font-bold text-lime-400" aria-hidden>
                        +
                      </span>
                      <span>
                        <span className="font-medium text-white">{PLAN_MODULE_INFO[m].label}</span>
                        <span className="text-slate-400"> — {PLAN_MODULE_INFO[m].blurb}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Not included yet</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Shown for your tier; unlock by upgrading when billing connects to Supabase.
                </p>
                <ul className="mt-3 space-y-2 text-sm text-slate-400">
                  {missingModules.map((m) => (
                    <li key={m} className="flex gap-2">
                      <span className="text-slate-600" aria-hidden>
                        —
                      </span>
                      <span>
                        <span className="font-medium text-slate-300">{PLAN_MODULE_INFO[m].label}</span>
                        <span className="text-slate-500"> — {PLAN_MODULE_INFO[m].blurb}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="vendor-section-title">Modules</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Operational modules stay local-first. Plan rules below use your effective plan (Supabase subscription when
            present, otherwise local session).
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {HUB_CARDS.map((card) => {
              const allowed =
                card.kind === "area"
                  ? planAllowsDashboardArea(effectivePlanId, card.area)
                  : (plan?.includedModules.some((m) => card.anyModule.includes(m)) ?? false);
              const gated = !allowed;
              const href = gated && card.kind === "area" ? "/plans" : card.href;
              return (
                <Link
                  key={card.title}
                  href={href}
                  className={[
                    "vc-card !block !p-5 transition-shadow hover:shadow-md",
                    gated
                      ? "border-amber-200 hover:border-amber-300"
                      : "hover:border-teal-300 hover:shadow-vc-glow-teal",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-heading text-base font-semibold text-slate-900">{card.title}</h3>
                    {gated ? (
                      <span className="vc-badge-warning shrink-0">Locked</span>
                    ) : (
                      <span className="vc-badge-success shrink-0">Included</span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{card.body}</p>
                  <p className="mt-4 text-sm font-semibold text-teal-700">
                    {gated ? "Upgrade on plans →" : "Open →"}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="vc-card-accent-teal">
          <h2 className="font-heading text-base font-semibold text-slate-900">Workspace profile</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Signed-in user</dt>
              <dd className="text-slate-900">{workspace?.user?.email ?? "— (local demo only)"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Tenant (Supabase)</dt>
              <dd className="text-slate-900">{workspace?.tenant?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Contact</dt>
              <dd className="text-slate-900">
                {workspace?.tenant?.contact_name ?? demo?.contactName ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Email (local bridge)</dt>
              <dd className="text-slate-900">{demo?.email ?? workspace?.user?.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Phone</dt>
              <dd className="text-slate-900">{workspace?.tenant?.phone ?? demo?.phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Plan id (effective)</dt>
              <dd className="font-mono text-sm text-slate-800">{effectivePlanId ?? "—"}</dd>
            </div>
            {demo ? (
              <div>
                <dt className="text-slate-500">Local session opened</dt>
                <dd className="font-mono text-sm text-slate-800">{formatSessionWhen(demo.createdAt)}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-slate-500">Local gates (inventory / POS / CashPlan)</dt>
              <dd className="font-mono text-xs leading-relaxed text-slate-800">
                inventory_stock:{" "}
                {planAllowsDashboardArea(effectivePlanId, "inventory") ? "allowed" : "blocked"} · pos_checkout:{" "}
                {planAllowsDashboardArea(effectivePlanId, "pos") ? "allowed" : "blocked"} · cash_plan:{" "}
                {planAllowsDashboardArea(effectivePlanId, "cashplan") ? "allowed" : "blocked"}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </>
  );
}
