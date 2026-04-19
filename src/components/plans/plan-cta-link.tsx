"use client";

import Link from "next/link";
import type { PlanId } from "@/lib/plans";
import { setSelectedPlanIntent } from "@/lib/plan-intent";

type Props = {
  planId: PlanId;
  href: string;
  className?: string;
  children: React.ReactNode;
};

export function PlanCtaLink({ planId, href, className, children }: Props) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => setSelectedPlanIntent(planId)}
    >
      {children}
    </Link>
  );
}
