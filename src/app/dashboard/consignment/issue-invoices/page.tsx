import Link from "next/link";
import { PlanGatedModule } from "@/components/dashboard/plan-gated-module";
import { DashboardTopBar } from "@/components/dashboard/dashboard-top-bar";
import { ConsignmentIssueInvoiceList } from "@/modules/consignment/ui/consignment-issue-invoice-list";

export default function ConsignmentIssueInvoicesPage() {
  return (
    <PlanGatedModule area="inventory">
      <DashboardTopBar
        title="Consignment issue invoices"
        subtitle="Formal stock movement from vendor warehouse to agent stall. Agents only receive sellable inventory after approval, posting, and custody update."
      />
      <div className="flex-1 space-y-4 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/consignment/issue-invoices/new"
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
          >
            New issue invoice
          </Link>
          <Link
            href="/dashboard/consignment/issue-invoices/queue"
            className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            Approval queue
          </Link>
          <Link href="/dashboard/consignment" className="rounded-lg px-4 py-2 text-sm text-neutral-400 hover:text-white">
            ← Consignment home
          </Link>
        </div>
        <ConsignmentIssueInvoiceList />
      </div>
    </PlanGatedModule>
  );
}
