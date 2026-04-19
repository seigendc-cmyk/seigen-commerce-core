"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const nav = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/market-space", label: "Market Space" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
] as const;

function linkClass(active: boolean) {
  return [
    "text-sm font-medium transition-colors",
    active ? "text-brand-orange" : "text-neutral-200 hover:text-white",
  ].join(" ");
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-brand-charcoal/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="rounded bg-brand-orange px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
            seiGEN
          </span>
          <span className="text-sm font-semibold text-white sm:text-base">Commerce</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={linkClass(pathname === item.href)}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/signin"
            className="rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-white transition-colors hover:border-brand-orange hover:text-brand-orange"
          >
            Sign in
          </Link>
          <Link
            href="/plans"
            className="rounded-lg bg-brand-orange px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-orange-hover"
          >
            View plans
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md border border-white/15 p-2 text-white md:hidden"
          aria-expanded={open}
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="sr-only">Menu</span>
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            {open ? (
              <path strokeWidth="2" strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeWidth="2" strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </div>

      {open ? (
        <div className="border-t border-white/10 bg-brand-charcoal px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-3">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={linkClass(pathname === item.href)}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/signin"
              className="mt-2 rounded-lg border border-white/15 px-3 py-2 text-center text-sm font-medium text-white"
              onClick={() => setOpen(false)}
            >
              Sign in
            </Link>
            <Link
              href="/plans"
              className="rounded-lg bg-brand-orange px-3 py-2 text-center text-sm font-semibold text-white"
              onClick={() => setOpen(false)}
            >
              View plans
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
