"use client";

import type { ConsignmentIssueInvoiceStatus } from "@/modules/consignment/types/consignment-issue-invoice";

const styles: Record<ConsignmentIssueInvoiceStatus, string> = {
  draft: "bg-neutral-600/40 text-neutral-200 border-white/10",
  pending_approval: "bg-amber-500/20 text-amber-100 border-amber-500/30",
  approved: "bg-emerald-500/20 text-emerald-100 border-emerald-500/30",
  rejected: "bg-rose-500/20 text-rose-100 border-rose-500/30",
  cancelled: "bg-neutral-800 text-neutral-400 border-white/10",
};

const labels: Record<ConsignmentIssueInvoiceStatus, string> = {
  draft: "Invoice (draft)",
  pending_approval: "Awaiting approval",
  approved: "Stock transferred",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export function ConsignmentIssueInvoiceStatusBadge({ status }: { status: ConsignmentIssueInvoiceStatus }) {
  return (
    <span className={`inline-flex rounded-lg border px-2 py-0.5 text-xs font-semibold ${styles[status]}`}>{labels[status]}</span>
  );
}
