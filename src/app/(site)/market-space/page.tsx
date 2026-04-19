import Link from "next/link";
import { Section } from "@/components/marketing/section";

export const metadata = { title: "Market Space" };

export default function MarketSpacePage() {
  return (
    <Section
      title="Market Space"
      subtitle="A vendor-first surface for listings, discovery, and controlled exposure to buyers. This section is a product story today and a live module tomorrow."
    >
      <div className="grid gap-6 lg:grid-cols-2">
               <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
          <h3 className="text-lg font-semibold text-neutral-900">Curated presence</h3>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600">
            Present SKUs, assortments, and branch availability with rules that match how you actually
            sell—retail, wholesale, or both.
          </p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
          <h3 className="text-lg font-semibold text-neutral-900">Governed growth</h3>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600">
            Plans gate capabilities so you can match packaging to customer segments without custom
            one-offs.
          </p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm lg:col-span-2">
          <h3 className="text-lg font-semibold text-neutral-900">Clear delivery signals</h3>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600">
            Listings can show when fulfilment may use an external verified iDeliver provider, so buyers see consistent
            badges alongside catalog data you control in the vendor dashboard.
          </p>
        </div>
      </div>
      <div className="mt-10">
        <Link
          href="/plans"
          className="inline-flex rounded-lg bg-brand-orange px-5 py-3 text-sm font-semibold text-white hover:bg-brand-orange-hover"
        >
          See plans
        </Link>
      </div>
    </Section>
  );
}
