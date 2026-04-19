import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { PendingProvisionSync } from "@/components/dashboard/pending-provision-sync";
import { WorkspaceProvider } from "@/components/dashboard/workspace-context";
import { getDashboardWorkspace } from "@/lib/workspace/server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const workspace = await getDashboardWorkspace();

  return (
    <WorkspaceProvider initialWorkspace={workspace}>
      <PendingProvisionSync />
      <div className="vendor-core-bg grid min-h-screen grid-cols-1 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <DashboardSidebar />
        <div className="vendor-dashboard-surface flex min-h-screen min-w-0 flex-col">{children}</div>
      </div>
    </WorkspaceProvider>
  );
}
