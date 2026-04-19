import { PlanGatedModule } from "@/components/dashboard/plan-gated-module";
import { CashPlanPage } from "@/modules/cash-plan/ui/cash-plan-page";

export default function CashPlanDashboardPage() {
  return (
    <PlanGatedModule area="cashplan">
      <CashPlanPage />
    </PlanGatedModule>
  );
}
