"use client";

import { DashboardTopBar } from "@/components/dashboard/dashboard-top-bar";
import { BiRulesPage } from "@/modules/bi/ui/bi-rules-page";

export default function DashboardBiRulesPage() {
  return (
    <>
      <DashboardTopBar
        title="BI — Business rules"
        subtitle="Routable policies for inventory, sales, staff, delivery, and more. Local-first; Supabase sync when wired."
      />
      <BiRulesPage />
    </>
  );
}
