"use client";

import { AgentGate } from "@/modules/agent/ui/agent-gate";
import { AgentDeskPage } from "@/modules/agent/ui/agent-desk-page";

export default function AgentDeskRoute() {
  return <AgentGate>{(ctx) => <AgentDeskPage ctx={ctx} />}</AgentGate>;
}

