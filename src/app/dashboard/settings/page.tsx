import { Suspense } from "react";
import { VendorSettingsPage } from "@/modules/dashboard/ui/vendor-settings-page";

export const metadata = { title: "Settings" };

export default function DashboardSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 px-4 py-8 text-sm text-neutral-700 sm:px-6">Loading settings…</div>
      }
    >
      <VendorSettingsPage />
    </Suspense>
  );
}
