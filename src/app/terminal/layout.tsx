import { VendorCoreProviders } from "@/components/dashboard/vendor-core-providers";
import { WorkspaceProvider } from "@/components/dashboard/workspace-context";
import { getDashboardWorkspace } from "@/lib/workspace/server";
import { TerminalPlanGate } from "./terminal-plan-gate";

export default async function TerminalRootLayout({ children }: { children: React.ReactNode }) {
  const workspace = await getDashboardWorkspace();
  return (
    <WorkspaceProvider initialWorkspace={workspace}>
      <VendorCoreProviders>
        <TerminalPlanGate>{children}</TerminalPlanGate>
      </VendorCoreProviders>
    </WorkspaceProvider>
  );
}
