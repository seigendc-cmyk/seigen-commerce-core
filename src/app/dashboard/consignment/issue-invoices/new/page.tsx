import Link from "next/link";
import { PlanGatedModule } from "@/components/dashboard/plan-gated-module";
import { DashboardTopBar } from "@/components/dashboard/dashboard-top-bar";
import { ConsignmentIssueInvoiceForm } from "@/modules/consignment/ui/consignment-issue-invoice-form";

export default async function NewConsignmentIssueInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const sp = await searchParams;
  const editId = typeof sp?.edit === "string" ? sp.edit : undefined;
  return (
    <PlanGatedModule area="inventory">
      <DashboardTopBar
        title={editId ? "Edit consignment issue invoice" : "New consignment issue invoice"}
        subtitle="Drafts are editable. Submitting reserves principal stock and sends the document for approval. The agent stall does not gain sellable stock until approval."
      />
      <div className="flex-1 space-y-4 px-4 py-6 sm:px-6">
        <Link href="/dashboard/consignment/issue-invoices" className="text-sm text-neutral-400 hover:text-white">
          ← Back to list
        </Link>
        <ConsignmentIssueInvoiceForm editInvoiceId={editId} />
      </div>
    </PlanGatedModule>
  );
}
