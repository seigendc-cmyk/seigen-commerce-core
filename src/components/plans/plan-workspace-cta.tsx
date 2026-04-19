"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { changeWorkspaceSubscriptionPlan } from "@/lib/workspace/actions";
import type { PlanId } from "@/lib/plans";
import { setSelectedPlanIntent } from "@/lib/plan-intent";
import Link from "next/link";

type Props = {
  planId: PlanId;
  planName: string;
  cta: string;
  canManagePlan: boolean;
};

export function PlanWorkspaceCta({ planId, planName, cta, canManagePlan }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!canManagePlan) {
    return (
      <Link
        href={`/signup?plan=${planId}`}
        className="mt-6 inline-flex w-full justify-center rounded-lg bg-brand-orange px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-orange-hover"
        onClick={() => setSelectedPlanIntent(planId)}
      >
        {cta}
      </Link>
    );
  }

  function applyPlan() {
    setError(null);
    setSelectedPlanIntent(planId);
    startTransition(async () => {
      const result = await changeWorkspaceSubscriptionPlan(planId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mt-6 space-y-2">
      <button
        type="button"
        onClick={applyPlan}
        disabled={pending}
        className="inline-flex w-full justify-center rounded-lg bg-brand-orange px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-orange-hover disabled:opacity-60"
      >
        {pending ? "Applying…" : `Apply ${planName} to workspace`}
      </button>
      <p className="text-center text-[11px] leading-snug text-neutral-500">
        Applies this plan to your workspace now. Module access updates to match the tier.
      </p>
      {error ? <p className="text-center text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
