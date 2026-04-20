"use client";

import { useMemo } from "react";
import {
  AGEING_BUCKET_LABELS,
  type AgeingBucketId,
  buildCreditorsAgeingReport,
  buildDebtorsAgeingReport,
} from "@/modules/cash-plan/services/cash-plan-ageing";
import { listCreditorEntries } from "@/modules/financial/services/creditors-ledger";
import { listDebtorEntries } from "@/modules/financial/services/debtors-ledger";

const BUCKET_ORDER: AgeingBucketId[] = ["not_yet_due", "d1_30", "d31_60", "d61_90", "d90_plus"];

function money(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function CashPlanCreditorsAgeingTab({ dataVersion }: { dataVersion: string }) {
  const rows = useMemo(() => buildCreditorsAgeingReport(listCreditorEntries(2000)), [dataVersion]);

  return (
    <section className="space-y-4 px-4 py-6 sm:px-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Creditors ageing (AP)</h2>
        <p className="mt-1 max-w-3xl text-sm text-neutral-400">
          Open supplier balances split by <strong className="text-neutral-300">invoice due date</strong>, with payments
          applied <strong className="text-neutral-300">FIFO</strong> against oldest invoices first. Same ledger data as
          Financial — nothing is posted from this view.
        </p>
      </div>
      <AgeingTable entityLabel="Supplier" rows={rows} />
    </section>
  );
}

export function CashPlanDebtorsAgeingTab({ dataVersion }: { dataVersion: string }) {
  const rows = useMemo(() => buildDebtorsAgeingReport(listDebtorEntries(2000)), [dataVersion]);

  return (
    <section className="space-y-4 px-4 py-6 sm:px-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Debtors ageing (AR)</h2>
        <p className="mt-1 max-w-3xl text-sm text-neutral-400">
          Customer balances split by due date with FIFO allocation of receipts. Mirrors your AR subledger; read-only.
        </p>
      </div>
      <AgeingTable entityLabel="Customer" rows={rows} />
    </section>
  );
}

function AgeingTable({
  entityLabel,
  rows,
}: {
  entityLabel: string;
  rows: ReturnType<typeof buildCreditorsAgeingReport>;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-neutral-500">
        No open balances to age — creditor/debtor activity will appear here when the ledgers have outstanding amounts.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full min-w-[880px] text-left text-sm">
        <thead className="border-b border-white/10 bg-white/[0.04] text-xs font-semibold uppercase tracking-wide text-neutral-400">
          <tr>
            <th className="px-3 py-2">{entityLabel}</th>
            <th className="px-3 py-2 text-right">Total</th>
            {BUCKET_ORDER.map((k) => (
              <th key={k} className="px-3 py-2 text-right">
                {AGEING_BUCKET_LABELS[k]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.entityId} className="border-b border-white/[0.06] hover:bg-white/[0.03]">
              <td className="px-3 py-2 font-medium text-neutral-100">{r.entityName}</td>
              <td className="px-3 py-2 text-right font-mono text-white">{money(r.total)}</td>
              {BUCKET_ORDER.map((k) => (
                <td key={k} className="px-3 py-2 text-right font-mono text-neutral-300">
                  {money(r.buckets[k])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
