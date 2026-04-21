"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type NavItem = { href: string; label: string; exact?: boolean };

const NAV: NavItem[] = [
  { href: "/agent/desk", label: "Desk", exact: true },
  { href: "/agent/pos", label: "POS Terminal" },
];

function isActive(pathname: string, it: NavItem): boolean {
  if (it.exact) return pathname === it.href;
  return pathname === it.href || pathname.startsWith(`${it.href}/`);
}

export function AgentShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";

  return (
    <div className="min-h-dvh bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto flex min-h-dvh w-full max-w-7xl">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white p-5 lg:flex lg:flex-col">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold tracking-wider text-slate-500">seiGEN</p>
              <p className="text-lg font-semibold text-slate-900">Agent Desk</p>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-700">
              consignment
            </span>
          </div>

          <nav className="mt-6 space-y-1">
            {NAV.map((it) => {
              const active = isActive(pathname, it);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  className={[
                    "flex items-center justify-between rounded-lg border px-3 py-2 text-sm font-semibold transition-colors",
                    active
                      ? "border-slate-300 bg-slate-100 text-slate-900"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900",
                  ].join(" ")}
                >
                  <span>{it.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto pt-6 text-xs text-slate-500">
            <p className="font-semibold text-slate-700">Governed by Vendor system</p>
            <p className="mt-1 leading-relaxed">
              Your stall operates as a branch-like unit under the Vendor’s seiGEN Commerce database. All stock, records,
              settlements, and accountability are system-governed.
            </p>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

