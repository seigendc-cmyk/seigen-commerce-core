import Link from "next/link";

import { SignOutButton } from "@/components/auth/sign-out-button";

export function SciShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-baseline gap-3">
            <Link
              href="/dashboard"
              className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
            >
              seiGEN Commerce
            </Link>
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              SCI
            </span>
          </div>
          <nav
            className="hidden items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400 sm:flex"
            aria-label="SCI navigation"
          >
            <span className="cursor-not-allowed opacity-50" title="Coming later">
              Console
            </span>
            <span className="cursor-not-allowed opacity-50" title="Coming later">
              Executive
            </span>
            <span className="cursor-not-allowed opacity-50" title="Coming later">
              iTred
            </span>
            <span className="cursor-not-allowed opacity-50" title="Coming later">
              iDeliver
            </span>
          </nav>
          <SignOutButton />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-4 py-6 sm:px-6">
        <aside className="hidden w-48 shrink-0 text-sm text-zinc-600 dark:text-zinc-400 lg:block">
          <p className="font-medium text-zinc-900 dark:text-zinc-200">Core</p>
          <ul className="mt-2 space-y-1">
            <li>
              <Link
                href="/dashboard"
                className="text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
              >
                Overview
              </Link>
            </li>
          </ul>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
