"use client";

import { DashboardTopBar } from "@/components/dashboard/dashboard-top-bar";
import { BrainEventsConsole } from "@/modules/brain/ui/brain-events-console";

export default function DashboardBrainPage() {
  return (
    <>
      <DashboardTopBar
        title="Brain"
        subtitle="Operational event stream — raw facts from POS and other emitters. Rules, alerts, and analytics build on this layer."
      />
      <BrainEventsConsole showHeader={false} />
    </>
  );
}
