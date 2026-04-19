"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo } from "react";
import { writeDemoSession } from "@/lib/demo-session";
import type { DashboardWorkspacePayload } from "@/lib/workspace/types";

const WorkspaceContext = createContext<DashboardWorkspacePayload | null>(null);

/**
 * Holds server-loaded Supabase workspace for the dashboard tree.
 * When tenant + subscription exist, mirrors commercial truth into the local demo session
 * so existing plan gates and POS/inventory local modules keep working during Phase 2A.
 */
export function WorkspaceProvider({
  initialWorkspace,
  children,
}: {
  initialWorkspace: DashboardWorkspacePayload | null;
  children: ReactNode;
}) {
  const workspace = initialWorkspace;

  useEffect(() => {
    if (!workspace?.tenant || !workspace.subscription) return;
    writeDemoSession({
      businessName: workspace.tenant.name,
      contactName: workspace.tenant.contact_name ?? "Primary contact",
      email: workspace.user.email ?? "",
      phone: workspace.tenant.phone ?? "—",
      planId: workspace.subscription.plan_id,
    });
  }, [workspace]);

  const value = useMemo(() => workspace, [workspace]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): DashboardWorkspacePayload | null {
  return useContext(WorkspaceContext);
}
