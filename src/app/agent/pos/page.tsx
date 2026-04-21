"use client";

import { AgentGate } from "@/modules/agent/ui/agent-gate";
import { AgentPosPage } from "@/modules/agent/ui/agent-pos-page";

export default function AgentPosRoute() {
  return <AgentGate>{(ctx) => <AgentPosPage ctx={ctx} />}</AgentGate>;
}

