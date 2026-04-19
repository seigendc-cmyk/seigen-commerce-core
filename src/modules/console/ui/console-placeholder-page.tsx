"use client";

import Link from "next/link";
import { ConsoleTopBar } from "./console-top-bar";

export function ConsolePlaceholderPage({
  title,
  description,
  whatWillBeHere,
}: {
  title: string;
  description: string;
  whatWillBeHere: string[];
}) {
  return (
    <>
      <ConsoleTopBar title={title} subtitle={description} />
      <div className="flex-1 space-y-6 px-4 py-6 sm:px-6">
        <section className="vendor-panel rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white">Coming soon (structured)</h2>
          <p className="mt-1 text-sm text-neutral-300">
            This page is intentionally operational-first: it shows the shape of the console without backend
            wiring yet.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-neutral-200">
            {whatWillBeHere.map((x) => (
              <li key={x} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-orange" aria-hidden />
                <span>{x}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/console/plans"
              className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-white hover:bg-brand-orange-hover"
            >
              View plans catalog
            </Link>
            <Link
              href="/dashboard"
              className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white hover:border-brand-orange hover:text-brand-orange"
            >
              Back to vendor dashboard
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}

