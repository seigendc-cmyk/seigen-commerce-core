import { PlanGatedModule } from "@/components/dashboard/plan-gated-module";
import { DashboardTopBar } from "@/components/dashboard/dashboard-top-bar";
import { ConsignmentIssueInvoiceDetail } from "@/modules/consignment/ui/consignment-issue-invoice-detail";

export default async function ConsignmentIssueInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PlanGatedModule area="inventory">
      <DashboardTopBar title="Issue invoice detail" subtitle="Review, approve, or audit this consignment issue." />
      <div className="flex-1 px-4 py-6 sm:px-6">
        <ConsignmentIssueInvoiceDetail invoiceId={id} />
      </div>
    </PlanGatedModule>
  );
}
