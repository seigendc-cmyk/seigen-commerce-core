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
import { useVendorStaff } from "@/modules/dashboard/settings/staff/vendor-staff-context";
import { getActiveStaffId } from "@/modules/desk/services/sysadmin-bootstrap";
import { getDeskProfileByStaffId } from "@/modules/desk/services/desk-profiles-store";

const items = [
  { href: "/dashboard/desk", label: "Desk", exact: true as const, area: undefined as undefined },
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
  const { staffMembers } = useVendorStaff();
  const [demo, setDemo] = useState<DemoVendorSession | null>(null);

  useEffect(() => {
    setDemo(readDemoSession());
  }, []);

  const planId = workspace?.subscription?.plan_id ?? demo?.planId ?? null;

  const showDesk = useMemo(() => {
    const id = getActiveStaffId() ?? staffMembers[0]?.id ?? null;
    if (!id) return true;
    const p = getDeskProfileByStaffId(id);
    if (!p) return true;
    if (p.deskKind === "sysadmin") return true;
    return p.hasDesk && !p.isTerminalOnly;
  }, [staffMembers]);

  const navResolved = useMemo(() => {
    const visible = showDesk ? items : items.filter((it) => it.href !== "/dashboard/desk");
    return visible.map((item) => {
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
  }, [planId, showDesk]);

  async function signOutAll() {
    await signOutVendorSession();
    router.push("/signin");
  }

  return (
    <aside className="vendor-panel flex w-full shrink-0 flex-col border-b border-slate-800/80 bg-slate-950 lg:w-64 lg:border-b-0 lg:border-r lg:border-slate-800/80">
      <div className="flex items-center gap-2 border-b border-slate-800/60 px-4 py-4">
        <span className="rounded bg-teal-600 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white ring-1 ring-teal-400/40">
          seiGEN
        </span>
        <span className="font-heading text-sm font-semibold text-white">Vendor</span>
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
                  ? "border-teal-400/35 bg-teal-500/15 text-teal-100 shadow-sm ring-1 ring-teal-400/20"
                  : "vendor-nav-link-inactive",
              ].join(" ")}
              title={item.locked ? "Not on current plan — opens plans to upgrade" : undefined}
            >
              <span>{item.label}</span>
              {item.locked ? (
                <span className="vc-badge-warning">Locked</span>
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
