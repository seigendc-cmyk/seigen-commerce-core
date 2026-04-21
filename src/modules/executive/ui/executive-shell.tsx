"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type NavItem = { href: string; label: string; exact?: boolean };

const NAV: NavItem[] = [{ href: "/executive", label: "Overview", exact: true }];

function isActive(pathname: string, it: NavItem): boolean {
  if (it.exact) return pathname === it.href;
  return pathname === it.href || pathname.startsWith(`${it.href}/`);
}

export function ExecutiveShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";

  return (
    <div data-vendor-app className="executive-core-bg flex min-h-dvh">
      <aside className="executive-panel hidden w-72 shrink-0 border-r border-white/10 p-5 lg:flex lg:flex-col">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold tracking-wider text-neutral-400">seiGEN</p>
            <p className="text-lg font-semibold text-white">Executive</p>
          </div>
          <span className="rounded-full border border-teal-500/35 bg-teal-500/15 px-2 py-1 text-[10px] font-semibold text-teal-200">
            governance
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
                    ? "border-teal-500/45 bg-teal-600/10 text-white"
                    : "border-white/18 bg-white/[0.06] text-neutral-100 hover:border-white/28 hover:bg-white/[0.09] hover:text-white",
                ].join(" ")}
              >
                <span>{it.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-6 text-xs text-neutral-400">
          <p className="font-semibold text-neutral-300">Local-first signal board</p>
          <p className="mt-1 leading-relaxed">
            This surface aggregates the current browser workspace state. It will evolve into role-based, audited
            governance once a backend is connected.
          </p>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}

