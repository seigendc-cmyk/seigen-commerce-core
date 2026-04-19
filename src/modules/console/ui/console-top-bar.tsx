"use client";

export function ConsoleTopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="flex flex-col gap-3 border-b border-white/10 bg-brand-charcoal/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div>
        <h1 className="text-lg font-semibold text-white sm:text-xl">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-neutral-300">{subtitle}</p> : null}
      </div>
      <span className="hidden rounded border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-neutral-200 sm:inline-flex">
        Console (local)
      </span>
    </header>
  );
}

