import Link from "next/link";

export function BankAccountsSettingsForm() {
  return (
    <section className="vendor-panel-soft rounded-2xl p-6">
      <h2 className="text-base font-semibold text-white">Bank account ledger</h2>
      <p className="mt-2 text-sm leading-relaxed text-neutral-300">
        The operating bank account ledger lives under Financial → CashBook alongside the cash book. Use it for transfers
        that fund COGS Reserves from the bank, and reconcile against your institution feeds when connectors are on.
      </p>
      <p className="mt-4 text-sm text-neutral-400">
        Storage key (local): <span className="font-mono text-xs text-neutral-500">seigen.financial:v1:bank_account</span>
      </p>
      <Link
        href="/dashboard/financial?tab=cashbook"
        className="mt-5 inline-flex rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
      >
        Open bank ledger in CashBook →
      </Link>
    </section>
  );
}
