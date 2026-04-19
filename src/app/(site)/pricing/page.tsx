import Link from "next/link";
import { Section } from "@/components/marketing/section";

export const metadata = { title: "Pricing" };

export default function PricingPage() {
  return (
    <Section
      title="Pricing"
      subtitle="Commercial packaging is organized by plan tiers. Detailed card layouts and limits live on the plans page; this view orients executives and operators."
    >
      <ul className="space-y-4 text-neutral-600">
        <li className="flex gap-3">
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-orange" aria-hidden />
          <span>
            <strong className="text-neutral-900">Free through Enterprise</strong> — scale from exploration
            to multi-branch and distributor footprints.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-orange" aria-hidden />
          <span>
            <strong className="text-neutral-900">Add-ons later</strong> — modules for inventory depth,
            POS lanes, and BI connect without re-platforming.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-orange" aria-hidden />
          <span>
            <strong className="text-neutral-900">Talk to us</strong> — Enterprise and complex rollouts
            start with a conversation.
          </span>
        </li>
      </ul>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/plans"
          className="rounded-lg bg-brand-orange px-5 py-3 text-sm font-semibold text-white hover:bg-brand-orange-hover"
        >
          Open plan cards
        </Link>
        <Link
          href="/contact"
          className="rounded-lg border border-neutral-300 bg-white px-5 py-3 text-sm font-semibold text-neutral-900 shadow-sm hover:border-brand-orange hover:text-brand-orange"
        >
          Contact sales
        </Link>
      </div>
    </Section>
  );
}
