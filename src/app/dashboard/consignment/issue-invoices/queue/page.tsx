import Link from "next/link";
import { PlanGatedModule } from "@/components/dashboard/plan-gated-module";
import { DashboardTopBar } from "@/components/dashboard/dashboard-top-bar";
import { ConsignmentIssueInvoiceQueue } from "@/modules/consignment/ui/consignment-issue-invoice-queue";

export default function ConsignmentIssueInvoiceQueuePage() {
  return (
    <PlanGatedModule area="inventory">
      <DashboardTopBar title="Consignment issue — approval queue" subtitle="Inspect and approve formal stock issues before agent trading begins." />
      <div className="flex-1 space-y-4 px-4 py-6 sm:px-6">
        <Link href="/dashboard/consignment/issue-invoices" className="text-sm text-neutral-400 hover:text-white">
          ← All invoices
        </Link>
        <ConsignmentIssueInvoiceQueue />
      </div>
    </PlanGatedModule>
  );
}
