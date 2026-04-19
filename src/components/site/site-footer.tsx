import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-brand-charcoal-soft">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">seiGEN Commerce</p>
          <p className="mt-1 max-w-md text-sm text-neutral-300">
            Local-first vendor workspace foundation. Inventory and POS modules plug in here next.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-neutral-300">
          <Link href="/about" className="hover:text-white">
            About
          </Link>
          <Link href="/market-space" className="hover:text-white">
            Market Space
          </Link>
          <Link href="/pricing" className="hover:text-white">
            Pricing
          </Link>
          <Link href="/contact" className="hover:text-white">
            Contact
          </Link>
          <Link href="/plans" className="hover:text-brand-orange hover:underline">
            Plans
          </Link>
        </div>
      </div>
      <div className="border-t border-white/5 py-4 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} seiGEN Commerce. Demo build — no backend connected.
      </div>
    </footer>
  );
}
