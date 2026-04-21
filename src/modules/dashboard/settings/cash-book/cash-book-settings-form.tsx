import Link from "next/link";

export function CashBookSettingsForm() {
  return (
    <section className="vendor-panel-soft rounded-2xl p-6">
      <h2 className="text-base font-semibold text-white">Cash Book</h2>
      <p className="mt-2 text-sm leading-relaxed text-neutral-300">
        Physical cash movements tie to the Cash Transactions ledger under Financial → CashBook. Record transfers into COGS
        Reserves when you move cash from the drawer into inventory funding, and review the running balance here.
      </p>
      <p className="mt-4 text-sm text-neutral-400">
        Storage key (local): <span className="font-mono text-xs text-neutral-500">seigen.financial:v1:cash_book</span>
      </p>
      <Link
        href="/dashboard/financial?tab=cashbook"
        className="mt-5 inline-flex rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
      >
        Open CashBook →
      </Link>
    </section>
  );
}
