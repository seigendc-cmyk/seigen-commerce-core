import { PlanGatedModule } from "@/components/dashboard/plan-gated-module";
import { PoolWisePage } from "@/modules/poolwise/ui/poolwise-page";

export default function PoolWiseDashboardPage() {
  return (
    <PlanGatedModule area="inventory">
      <PoolWisePage />
    </PlanGatedModule>
  );
}

