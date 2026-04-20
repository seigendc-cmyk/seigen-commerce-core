import { PlanGatedModule } from "@/components/dashboard/plan-gated-module";
import { ConsignmentPage } from "@/modules/consignment/ui/consignment-page";

export default function ConsignmentDashboardPage() {
  return (
    <PlanGatedModule area="inventory">
      <ConsignmentPage />
    </PlanGatedModule>
  );
}

