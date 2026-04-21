"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { listInvoicesByStatus } from "@/modules/consignment/services/consignment-issue-invoice.service";
import { CONSIGNMENT_ISSUE_INVOICE_EVENT } from "@/modules/consignment/services/consignment-issue-invoice-storage";
import { ConsignmentIssueInvoiceStatusBadge } from "@/modules/consignment/ui/consignment-issue-invoice-status-badge";
import type { ConsignmentIssueInvoicePermissionSnapshot } from "@/modules/consignment/services/consignment-issue-permissions";
import { loadIssueInvoicePermissions } from "@/modules/consignment/services/consignment-issue-permissions";

function money(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function ConsignmentIssueInvoiceQueue() {
  const [tick, setTick] = useState(0);
  const [perms, setPerms] = useState<ConsignmentIssueInvoicePermissionSnapshot | null>(null);
  useEffect(() => {
    const on = () => setTick((t) => t + 1);
    window.addEventListener(CONSIGNMENT_ISSUE_INVOICE_EVENT, on);
    return () => window.removeEventListener(CONSIGNMENT_ISSUE_INVOICE_EVENT, on);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const snap = await loadIssueInvoicePermissions({});
      if (cancelled) return;
      setPerms(snap);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pending = useMemo(() => {
    void tick;
    return listInvoicesByStatus("pending_approval");
  }, [tick]);

  if (perms && !perms.canApproveOrReject) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6 text-sm text-neutral-300">
        Approval queue is restricted. You do not have the approval permission for consignment issue invoices.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-400">
        Authorised staff review issue invoices here before agent stalls receive sellable stock. Principal warehouse quantity is already reserved while pending.
      </p>
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.04] text-xs font-semibold uppercase text-neutral-400">
            <tr>
              <th className="px-3 py-2">Document</th>
              <th className="px-3 py-2">Agent</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {pending.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-neutral-500">
                  No invoices awaiting approval.
                </td>
              </tr>
            ) : (
              pending.map((r) => (
                <tr key={r.id} className="border-b border-white/[0.06]">
                  <td className="px-3 py-2 font-mono text-neutral-200">{r.documentNumber}</td>
                  <td className="px-3 py-2 text-neutral-300">
                    {r.agentName}
                    <div className="text-xs text-neutral-500">{r.issuingBranchName}</div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{money(r.totalValue)}</td>
                  <td className="px-3 py-2">
                    <ConsignmentIssueInvoiceStatusBadge status={r.status} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/dashboard/consignment/issue-invoices/${r.id}`}
                      className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"
                    >
                      Review
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
