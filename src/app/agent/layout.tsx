import type { ReactNode } from "react";
import { AgentShell } from "@/modules/agent/ui/agent-shell";

export const metadata = { title: "Agent" };

export default function AgentLayout({ children }: { children: ReactNode }) {
  return <AgentShell>{children}</AgentShell>;
}

