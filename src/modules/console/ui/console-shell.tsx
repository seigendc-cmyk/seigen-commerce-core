"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ConsoleNavItem } from "../types/console";

const NAV: ConsoleNavItem[] = [
  { href: "/console", label: "Overview", exact: true },
  { href: "/console/events", label: "Brain events" },
  { href: "/console/plans", label: "Plans" },
  { href: "/console/features", label: "Features" },
  { href: "/console/subscriptions", label: "Subscriptions" },
  { href: "/console/activation", label: "Activation" },
  { href: "/console/overrides", label: "Overrides" },
];

function isActive(pathname: string, item: ConsoleNavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function ConsoleShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="grid min-h-screen grid-cols-1 bg-brand-charcoal lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="flex w-full flex-col border-b border-white/10 bg-brand-charcoal-soft lg:w-auto lg:min-h-screen lg:border-b-0 lg:border-r lg:border-white/10">
        <div className="flex items-center gap-2 px-4 py-4">
          <span className="rounded bg-brand-orange px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
            seiGEN
          </span>
          <span className="text-sm font-semibold text-white">Console</span>
          <span className="ml-auto rounded bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-300">
            local-first
          </span>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-4 lg:flex-col lg:overflow-x-visible lg:px-3">
          {NAV.map((item) => {
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors lg:shrink",
                  active
                    ? "bg-white/10 text-brand-orange shadow-sm"
                    : "text-neutral-200 hover:bg-white/[0.08] hover:text-white",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto hidden border-t border-white/10 p-3 text-xs text-neutral-400 lg:block">
          Console is local-only for now. No backend entitlements or billing are enforced yet.
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col bg-brand-charcoal">{children}</div>
    </div>
  );
}

