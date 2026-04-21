import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { VendorCoreProviders } from "@/components/dashboard/vendor-core-providers";
import { PendingProvisionSync } from "@/components/dashboard/pending-provision-sync";
import { StaffSessionGate } from "@/components/dashboard/staff-session-gate";
import { WorkspaceProvider } from "@/components/dashboard/workspace-context";
import { getDashboardWorkspace } from "@/lib/workspace/server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const workspace = await getDashboardWorkspace();

  return (
    <WorkspaceProvider initialWorkspace={workspace}>
      <VendorCoreProviders>
        <PendingProvisionSync />
        <StaffSessionGate>
          <div
            data-vendor-app
            className="vendor-core-bg grid min-h-dvh grid-cols-1 lg:grid-cols-[16rem_minmax(0,1fr)]"
          >
            <DashboardSidebar />
            <div className="vendor-dashboard-surface flex min-h-screen min-w-0 flex-col">{children}</div>
          </div>
        </StaffSessionGate>
      </VendorCoreProviders>
    </WorkspaceProvider>
  );
}
