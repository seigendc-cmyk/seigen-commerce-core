"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { authzCheck } from "@/modules/authz/authz-actions";
import type { PermissionCheckResult } from "@/modules/authz/types";
import { RbacAccessDenied } from "./rbac-access-denied";

const NAV = [
  { href: "/dashboard/desk/security/roles", label: "Roles" },
  { href: "/dashboard/desk/security/matrix", label: "Permission matrix" },
  { href: "/dashboard/desk/security/users", label: "Users & access" },
  { href: "/dashboard/desk/security/terminal-access", label: "Terminal access" },
  { href: "/dashboard/desk/security/audit", label: "Audit history" },
  { href: "/dashboard/desk/security/registry", label: "Permission registry" },
  { href: "/dashboard/desk/security/governance/approvals", label: "Governance" },
  { href: "/dashboard/desk/consignment/remittances", label: "Consignment remittances" },
] as const;

export function SecurityConsoleLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const [state, setState] = useState<"loading" | "ok" | "denied">("loading");
  const [denied, setDenied] = useState<PermissionCheckResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const r = await authzCheck("desk.sysadmin.access");
      if (cancelled) return;
      if (r.allowed) setState("ok");
      else {
        setDenied(r);
        setState("denied");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="h-10 w-10 animate-pulse rounded-full bg-white/10" />
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        <RbacAccessDenied denied={denied} title="Security console locked" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <header className="vendor-panel-soft rounded-2xl p-5">
        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">SysAdmin desk · Security</div>
        <h1 className="mt-1 text-xl font-semibold text-white">Role &amp; permissions</h1>
        <p className="mt-2 max-w-3xl text-sm text-neutral-400">
          Governance console for Supabase RBAC (Pack 1 + Pack 2). Writes require workspace Owner/Admin in Supabase plus
          the matching governance permission keys.
        </p>
        <nav className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
          {NAV.map((n) => {
            const active = pathname === n.href || pathname.startsWith(`${n.href}/`);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={[
                  "rounded-lg px-3 py-2 text-sm font-semibold",
                  active ? "bg-teal-600 text-white" : "border border-white/15 bg-white/5 text-neutral-200 hover:bg-white/10",
                ].join(" ")}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
