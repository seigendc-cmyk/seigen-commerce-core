"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTerminalSession } from "../state/terminal-session-context";
import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";

const NAV: { href: (code: string) => string; label: string; match: (path: string, code: string) => boolean }[] = [
  {
    href: (c) => `/terminal/${c}`,
    label: "Products",
    match: (path, c) => path === `/terminal/${c}` || path === `/terminal/${c}/`,
  },
  {
    href: (c) => `/terminal/${c}/cart`,
    label: "Cart",
    match: (path, c) => path.startsWith(`/terminal/${c}/cart`) || path.startsWith(`/terminal/${c}/checkout`),
  },
  {
    href: (c) => `/terminal/${c}/receipts`,
    label: "Receipts",
    match: (path, c) => path.startsWith(`/terminal/${c}/receipts`),
  },
  { href: (c) => `/terminal/${c}/shift`, label: "Shift", match: (path, c) => path.startsWith(`/terminal/${c}/shift`) },
];

export function TerminalShell({
  children,
  hideNav,
}: {
  children: React.ReactNode;
  hideNav?: boolean;
}) {
  const pathname = usePathname() ?? "";
  const { accessCode, profile, session, openShift, online, signOut } = useTerminalSession();
  const branch = profile ? InventoryRepo.getBranch(profile.branchId) : undefined;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-900 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white shadow-md">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-orange-400">Terminal</div>
            <div className="truncate text-base font-semibold leading-tight">
              {profile?.operatorLabel ?? "…"} · {profile?.terminalCode ?? accessCode}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
              <span className="rounded-full bg-white/10 px-2 py-0.5 font-medium text-white/90">
                {branch?.name ?? "Branch"}
              </span>
              <span
                className={[
                  "rounded-full px-2 py-0.5 font-semibold",
                  online ? "bg-emerald-500/20 text-emerald-200" : "bg-amber-500/20 text-amber-100",
                ].join(" ")}
              >
                {online ? "Online" : "Offline"}
              </span>
              {openShift ? (
                <span className="rounded-full bg-orange-500/25 px-2 py-0.5 font-semibold text-orange-100">
                  Shift open
                </span>
              ) : (
                <span className="rounded-full bg-red-500/20 px-2 py-0.5 font-semibold text-red-100">No shift</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => signOut()}
            className="shrink-0 rounded-lg border border-white/20 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-white/10"
          >
            Sign out
          </button>
        </div>
        {session ? (
          <div className="mt-2 truncate text-[10px] text-slate-500">Session {session.id.slice(0, 18)}…</div>
        ) : null}
      </header>

      <main className="flex-1 overflow-y-auto pb-[calc(4.25rem+env(safe-area-inset-bottom))]">{children}</main>

      {!hideNav ? (
        <nav className="fixed bottom-0 left-0 right-0 z-20 flex border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
          {NAV.map((n) => {
            const active = n.match(pathname, accessCode);
            return (
              <Link
                key={n.label}
                href={n.href(accessCode)}
                className={[
                  "flex flex-1 flex-col items-center justify-center py-2 text-[11px] font-semibold",
                  active ? "text-orange-600" : "text-slate-500 hover:text-slate-800",
                ].join(" ")}
              >
                <span className="h-1 w-8 rounded-full" style={{ background: active ? "#ea580c" : "transparent" }} />
                {n.label}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
