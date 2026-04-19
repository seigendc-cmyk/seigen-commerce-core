import { Suspense } from "react";
import { FinancialDashboardPage } from "@/modules/financial/ui/financial-dashboard-page";

export default function FinancialPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-neutral-400">Loading…</div>}>
      <FinancialDashboardPage />
    </Suspense>
  );
}
