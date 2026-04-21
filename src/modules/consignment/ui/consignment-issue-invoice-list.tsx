"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { listIssueInvoices } from "@/modules/consignment/services/consignment-issue-invoice-storage";
import { CONSIGNMENT_ISSUE_INVOICE_EVENT } from "@/modules/consignment/services/consignment-issue-invoice-storage";
import { ConsignmentIssueInvoiceStatusBadge } from "@/modules/consignment/ui/consignment-issue-invoice-status-badge";

function money(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function ConsignmentIssueInvoiceList() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const on = () => setTick((t) => t + 1);
    window.addEventListener(CONSIGNMENT_ISSUE_INVOICE_EVENT, on);
    window.addEventListener("storage", on);
    return () => {
      window.removeEventListener(CONSIGNMENT_ISSUE_INVOICE_EVENT, on);
      window.removeEventListener("storage", on);
    };
  }, []);

  const rows = useMemo(() => {
    void tick;
    return listIssueInvoices();
  }, [tick]);

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full min-w-[880px] text-left text-sm">
        <thead className="border-b border-white/10 bg-white/[0.04] text-xs font-semibold uppercase tracking-wide text-neutral-400">
          <tr>
            <th className="px-3 py-2">Document</th>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Agent / stall</th>
            <th className="px-3 py-2">Issuing branch</th>
            <th className="px-3 py-2 text-right">Total</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-3 py-8 text-center text-neutral-500">
                No consignment issue invoices yet.{" "}
                <Link href="/dashboard/consignment/issue-invoices/new" className="font-semibold text-teal-400 hover:underline">
                  Create one
                </Link>
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id} className="border-b border-white/[0.06] last:border-0">
                <td className="px-3 py-2 font-mono text-neutral-200">{r.documentNumber}</td>
                <td className="px-3 py-2 text-neutral-400">{r.invoiceDate}</td>
                <td className="px-3 py-2 text-neutral-200">
                  {r.agentName}
                  <div className="text-xs text-neutral-500">{r.agentStallName}</div>
                </td>
                <td className="px-3 py-2 text-neutral-400">{r.issuingBranchName}</td>
                <td className="px-3 py-2 text-right font-mono text-neutral-200">{money(r.totalValue)}</td>
                <td className="px-3 py-2">
                  <ConsignmentIssueInvoiceStatusBadge status={r.status} />
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/dashboard/consignment/issue-invoices/${r.id}`}
                    className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
