"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { signOutVendorSession } from "@/lib/auth/sign-out-client";
import type { DemoVendorSession } from "@/lib/demo-session";
import { readDemoSession } from "@/lib/demo-session";
import type { DashboardProductArea } from "@/lib/local-plan-gates";
import { planAllowsDashboardArea } from "@/lib/local-plan-gates";
import { useWorkspace } from "./workspace-context";

const items = [
  { href: "/dashboard", label: "Overview", exact: true as const, area: undefined as undefined },
  {
    href: "/dashboard/inventory",
    label: "Inventory",
    exact: false as const,
    area: "inventory" as DashboardProductArea,
  },
  { href: "/dashboard/pos", label: "Point of sale", exact: false as const, area: "pos" as DashboardProductArea },
  { href: "/dashboard/financial", label: "Financial", exact: false as const, area: undefined as undefined },
  { href: "/dashboard/consignment", label: "Consignment", exact: false as const, area: undefined as undefined },
  { href: "/dashboard/poolwise", label: "PoolWise", exact: false as const, area: undefined as undefined },
  {
    href: "/dashboard/cash-plan",
    label: "CashPlan",
    exact: false as const,
    area: "cashplan" as DashboardProductArea,
  },
  { href: "/dashboard/brain", label: "Brain", exact: false as const, area: undefined as undefined },
  { href: "/dashboard/bi/rules", label: "BI rules", exact: false as const, area: undefined as undefined },
  { href: "/dashboard/settings", label: "Settings", exact: false as const, area: undefined as undefined },
] as const;

export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const workspace = useWorkspace();
  const [demo, setDemo] = useState<DemoVendorSession | null>(null);

  useEffect(() => {
    setDemo(readDemoSession());
  }, []);

  const planId = workspace?.subscription?.plan_id ?? demo?.planId ?? null;

  const navResolved = useMemo(() => {
    return items.map((item) => {
      if (!item.area) {
        return { ...item, resolvedHref: item.href, locked: false };
      }
      const allowed = planAllowsDashboardArea(planId, item.area);
      return {
        ...item,
        resolvedHref: allowed ? item.href : "/plans",
        locked: !allowed,
      };
    });
  }, [planId]);

  async function signOutAll() {
    await signOutVendorSession();
    router.push("/signin");
  }

  return (
    <aside className="vendor-panel flex w-full shrink-0 flex-col border-b border-white/10 lg:w-64 lg:border-b-0 lg:border-r">
      <div className="flex items-center gap-2 px-4 py-4">
        <span className="rounded bg-brand-orange px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
          seiGEN
        </span>
        <span className="text-sm font-semibold text-white">Vendor</span>
      </div>
      <nav className="flex gap-1 px-2 pb-4 lg:flex-col lg:px-3">
        {navResolved.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.resolvedHref}
              className={[
                "flex items-center justify-between gap-2 rounded-lg border border-transparent px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-white/10 bg-white/10 text-brand-orange shadow-sm"
                  : "vendor-nav-link-inactive",
              ].join(" ")}
              title={item.locked ? "Not on current plan — opens plans to upgrade" : undefined}
            >
              <span>{item.label}</span>
              {item.locked ? (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-300/90">Locked</span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto hidden border-t border-white/10 p-3 lg:block">
        <button
          type="button"
          onClick={() => void signOutAll()}
          className="vendor-btn-secondary-dark w-full text-left"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
