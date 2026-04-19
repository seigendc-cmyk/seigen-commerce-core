"use client";

import Link from "next/link";

export function ExecutiveTopBar({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="executive-panel border-b border-white/10 px-4 py-4 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wide text-neutral-400">Executive</p>
          <h1 className="mt-1 text-lg font-semibold text-white sm:text-xl">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-neutral-300">{subtitle}</p> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-brand-orange/30 bg-brand-orange/10 px-2.5 py-1 text-[11px] font-semibold text-brand-orange">
            local-first
          </span>
          <Link
            href="/dashboard"
            className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-neutral-200 hover:border-brand-orange/60 hover:text-white"
          >
            Vendor dashboard
          </Link>
          <Link
            href="/console"
            className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-neutral-200 hover:border-brand-orange/60 hover:text-white"
          >
            Console
          </Link>
        </div>
      </div>
    </header>
  );
}

