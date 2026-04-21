"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DashboardTopBar } from "@/components/dashboard/dashboard-top-bar";
import type { DemoVendorSession } from "@/lib/demo-session";
import { readDemoSession } from "@/lib/demo-session";
import type { DashboardProductArea } from "@/lib/local-plan-gates";
import { planAllowsDashboardArea } from "@/lib/local-plan-gates";
import { PlanLockedPanel } from "./plan-locked-panel";
import { useWorkspace } from "./workspace-context";

type Props = {
  area: DashboardProductArea;
  children: React.ReactNode;
};

export function PlanGatedModule({ area, children }: Props) {
  const workspace = useWorkspace();
  const [session, setSession] = useState<DemoVendorSession | null | undefined>(undefined);

  useEffect(() => {
    setSession(readDemoSession());
  }, []);

  if (session === undefined) {
    return (
      <>
        <DashboardTopBar title="Loading…" subtitle="Checking workspace access" />
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-neutral-700">Loading…</div>
      </>
    );
  }

  const effectivePlanId = workspace?.subscription?.plan_id ?? session?.planId ?? null;
  const hasSurface = Boolean(workspace?.user) || session !== null;

  if (!hasSurface) {
    return (
      <>
        <DashboardTopBar title="Workspace" subtitle="Sign in required" />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
          <p className="max-w-md text-sm text-neutral-700">
            Sign up or sign in to attach a plan to this workspace before opening dashboard modules.
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

  if (!planAllowsDashboardArea(effectivePlanId, area)) {
    return <PlanLockedPanel area={area} planId={effectivePlanId} />;
  }

  return <>{children}</>;
}
