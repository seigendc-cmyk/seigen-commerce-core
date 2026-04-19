"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PlanId } from "@/lib/plans";
import { writeDemoSession } from "@/lib/demo-session";
import { getSelectedPlanIntent } from "@/lib/plan-intent";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function resolvePlan(): PlanId {
    return getSelectedPlanIntent() ?? "starter";
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (isSupabaseConfigured()) {
        const supabase = createBrowserSupabaseClient();
        const { error: signErr } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signErr) {
          setError(signErr.message);
          return;
        }
        router.refresh();
        router.push("/dashboard");
        return;
      }

      const planId = resolvePlan();
      writeDemoSession({
        businessName: "Existing vendor (demo sign-in)",
        contactName: "Store operator",
        email: email.trim() || "vendor@example.com",
        phone: "—",
        planId,
      });
      router.push("/dashboard");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      method="post"
      onSubmit={(e) => void onSubmit(e)}
      className="mx-auto max-w-md space-y-5 rounded-2xl border border-neutral-200 bg-white p-8 shadow-lg"
    >
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Vendor sign in</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {isSupabaseConfigured()
            ? "Sign in with your Supabase-backed account. Inventory and POS stay local in this phase."
            : "Supabase env vars are not set — this tab uses the local demo sign-in path only."}
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      ) : null}

      <div>
        <label className="block text-sm font-medium text-neutral-700" htmlFor="signin-email">
          Email
        </label>
        <input
          id="signin-email"
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none ring-brand-orange focus:ring-2"
          autoComplete="email"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700" htmlFor="signin-password">
          Password
        </label>
        <input
          id="signin-password"
          name="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none ring-brand-orange focus:ring-2"
          autoComplete="current-password"
        />
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-brand-orange py-2.5 text-sm font-semibold text-white hover:bg-brand-orange-hover disabled:opacity-50"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>

      <p className="text-center text-sm text-neutral-600">
        New vendor?{" "}
        <Link href="/plans" className="font-semibold text-brand-orange hover:underline">
          View plans and sign up
        </Link>
      </p>
    </form>
  );
}
