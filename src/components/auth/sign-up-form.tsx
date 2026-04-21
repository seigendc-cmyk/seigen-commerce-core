"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { writeDemoSession } from "@/lib/demo-session";
import { getPlanById, type PlanId } from "@/lib/plans";
import { getSelectedPlanIntent, setSelectedPlanIntent } from "@/lib/plan-intent";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { provisionWorkspaceAfterSignup } from "@/lib/workspace/actions";
import { PENDING_WORKSPACE_PROVISION_KEY } from "@/lib/workspace/pending-provision";

function isPlanId(v: string): v is PlanId {
  return getPlanById(v) !== undefined;
}

function initialPlanIdFromQuery(q: string | undefined): PlanId | null {
  if (q && isPlanId(q)) return q;
  return null;
}

export function SignUpForm({ planFromQuery }: { planFromQuery?: string }) {
  const router = useRouter();

  const [planId, setPlanId] = useState<PlanId | null>(() => initialPlanIdFromQuery(planFromQuery));
  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const fromQuery = initialPlanIdFromQuery(planFromQuery);
    if (fromQuery) {
      setPlanId(fromQuery);
      setSelectedPlanIntent(fromQuery);
      return;
    }
    const stored = getSelectedPlanIntent();
    if (stored) {
      setPlanId(stored);
      return;
    }
    router.replace("/plans");
  }, [planFromQuery, router]);

  const plan = useMemo(() => (planId ? getPlanById(planId) : undefined), [planId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!planId) return;
    setError(null);
    setInfo(null);
    setBusy(true);

    const biz = businessName.trim() || "Untitled business";
    const contact = contactName.trim() || "Primary contact";
    const em = email.trim() || "vendor@example.com";
    const ph = phone.trim() || "—";

    try {
      if (isSupabaseConfigured()) {
        const supabase = createBrowserSupabaseClient();
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const { data, error: signErr } = await supabase.auth.signUp({
          email: em,
          password,
          options: {
            emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
            data: {
              plan_id: planId,
              business_name: biz,
              contact_name: contact,
              phone: ph,
            },
          },
        });

        if (signErr) {
          setError(signErr.message);
          return;
        }

        if (data.session) {
          const prov = await provisionWorkspaceAfterSignup({
            businessName: biz,
            contactName: contact,
            phone: ph,
            planId,
          });
          if (!prov.ok) {
            setError(prov.error);
            return;
          }
          window.localStorage.removeItem(PENDING_WORKSPACE_PROVISION_KEY);
          router.refresh();
          router.push("/dashboard");
          return;
        }

        window.localStorage.setItem(
          PENDING_WORKSPACE_PROVISION_KEY,
          JSON.stringify({
            businessName: biz,
            contactName: contact,
            phone: ph,
            planId,
          }),
        );
        setInfo(
          "Confirm your email to finish setup. After you click the link, we will create your workspace automatically.",
        );
        return;
      }

      writeDemoSession({
        businessName: biz,
        contactName: contact,
        email: em,
        phone: ph,
        planId,
      });
      router.push("/dashboard");
    } finally {
      setBusy(false);
    }
  }

  if (!planId || !plan) {
    return (
      <p className="text-center text-sm text-neutral-600">Redirecting to plans to choose packaging…</p>
    );
  }

  const planSummary = (
    <div className="space-y-4 rounded-2xl border border-brand-orange/40 bg-gradient-to-b from-orange-50/90 via-white to-white p-5 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Your selected plan</p>
        <p className="mt-1 text-xl font-semibold text-neutral-900">{plan.name}</p>
        <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-brand-orange">
          {plan.monthlyPriceLabel}
          {plan.monthlyPriceLabel !== "Custom" ? (
            <span className="text-sm font-semibold text-neutral-600">/mo</span>
          ) : null}
        </p>
      </div>
      <p className="text-sm font-medium text-neutral-800">{plan.purpose}</p>
      <div className="rounded-lg border border-neutral-200 bg-white/80 px-3 py-2 text-xs text-neutral-700">
        <p className="font-semibold text-neutral-500">Who this fits</p>
        <p className="mt-1 leading-snug">{plan.audience}</p>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Key features</p>
        <ul className="mt-2 space-y-1.5 text-sm text-neutral-700">
          {plan.highlights.slice(0, 4).map((h) => (
            <li key={h} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-orange" aria-hidden />
              <span>{h}</span>
            </li>
          ))}
        </ul>
      </div>
      <Link
        href="/plans"
        className="inline-flex w-full justify-center rounded-lg border border-neutral-300 bg-white px-3 py-2 text-center text-sm font-semibold text-neutral-800 hover:border-brand-orange hover:text-brand-orange"
      >
        Change plan
      </Link>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8 border-b border-neutral-200 pb-6 lg:hidden">{planSummary}</div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-start">
        <form
          method="post"
          onSubmit={(e) => void onSubmit(e)}
          className="space-y-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-lg sm:p-8"
        >
          <div className="hidden border-b border-neutral-100 pb-5 lg:block">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold text-neutral-900">Create your workspace</h1>
                <p className="mt-1 max-w-xl text-sm text-neutral-600">
                  {isSupabaseConfigured()
                    ? "We create your Supabase auth user, tenant, owner membership, and subscription record. Inventory and POS remain local in this phase."
                    : "Supabase is not configured — this flow stays local-only in this browser tab."}
                </p>
              </div>
              <div className="rounded-lg border border-brand-orange/50 bg-neutral-50 px-3 py-2 text-right">
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Plan</p>
                <p className="text-sm font-semibold text-brand-orange">{plan.name}</p>
                <p className="text-xs tabular-nums text-neutral-600">
                  {plan.monthlyPriceLabel}
                  {plan.monthlyPriceLabel !== "Custom" ? "/mo" : ""}
                </p>
              </div>
            </div>
          </div>

          <div className="lg:hidden">
            <h1 className="text-xl font-semibold text-neutral-900">Create your workspace</h1>
            <p className="mt-1 text-sm text-neutral-600">
              You are signing up on <span className="font-semibold text-brand-orange">{plan.name}</span> — see full
              plan details above.
            </p>
          </div>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
          ) : null}
          {info ? (
            <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">{info}</div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-neutral-700" htmlFor="biz">
                Legal or trade name
              </label>
              <input
                id="biz"
                name="businessName"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none ring-brand-orange focus:ring-2"
                placeholder="e.g. Northwind Retail Ltd"
                autoComplete="organization"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-neutral-700" htmlFor="contact">
                Primary contact name
              </label>
              <input
                id="contact"
                name="contactName"
                required
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none ring-brand-orange focus:ring-2"
                placeholder="Full name of owner or ops lead"
                autoComplete="name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700" htmlFor="su-email">
                Work email
              </label>
              <input
                id="su-email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none ring-brand-orange focus:ring-2"
                placeholder="you@company.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700" htmlFor="su-phone">
                Phone
              </label>
              <input
                id="su-phone"
                name="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none ring-brand-orange focus:ring-2"
                placeholder="Direct line or WhatsApp"
                autoComplete="tel"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-neutral-700" htmlFor="su-password">
                Password
              </label>
              <input
                id="su-password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none ring-brand-orange focus:ring-2"
                autoComplete="new-password"
              />
              <p className="mt-1 text-xs text-neutral-500">
                {isSupabaseConfigured()
                  ? "Stored by Supabase Auth — use a strong password you control."
                  : "Local-only mode: password is not sent to a backend until Supabase is configured."}
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-brand-orange py-2.5 text-sm font-semibold text-white hover:bg-brand-orange-hover disabled:opacity-50"
          >
            {busy ? "Working…" : isSupabaseConfigured() ? "Create account & workspace" : "Open dashboard (local)"}
          </button>

          <p className="text-center text-sm text-neutral-600">
            Already onboard?{" "}
            <Link href="/signin" className="font-semibold text-brand-orange hover:underline">
              Sign in
            </Link>
          </p>
        </form>

        <aside className="hidden lg:sticky lg:top-24 lg:block">{planSummary}</aside>
      </div>
    </div>
  );
}
