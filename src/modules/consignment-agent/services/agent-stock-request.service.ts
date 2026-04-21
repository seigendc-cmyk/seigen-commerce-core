import type { Id } from "@/modules/inventory/types/models";
import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";
import { createNotification } from "@/modules/desk/services/notification-service";
import { pushAgentNotification, upsertStockRequest } from "./agent-storage";
import type { AgentStockRequest, AgentStockRequestLine } from "../types/agent";

function uid(p: string): string {
  return `${p}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}
function nowIso(): string {
  return new Date().toISOString();
}

export function submitStockRequest(input: {
  stallBranchId: Id;
  agentId: string;
  agentName: string;
  actorLabel: string;
  priority: "normal" | "urgent";
  remarks?: string;
  lines: Array<{ productId: Id; qty: number }>;
}): { ok: true; request: AgentStockRequest } | { ok: false; error: string } {
  const branch = InventoryRepo.getBranch(input.stallBranchId);
  if (!branch) return { ok: false, error: "Stall branch not found." };
  const rawLines = input.lines
    .map((l) => ({ productId: l.productId, qty: Math.floor(Number(l.qty)) }))
    .filter((l) => l.productId && Number.isFinite(l.qty) && l.qty > 0);
  if (rawLines.length < 1) return { ok: false, error: "Add at least one product line." };

  const lines: AgentStockRequestLine[] = rawLines.map((l) => {
    const p = InventoryRepo.getProduct(l.productId);
    return {
      id: uid("asrl"),
      productId: l.productId,
      sku: p?.sku ?? "",
      productName: p?.name ?? l.productId,
      requestedQty: l.qty,
    };
  });

  const row: AgentStockRequest = {
    id: uid("asr"),
    stallBranchId: input.stallBranchId,
    agentId: input.agentId,
    agentName: input.agentName,
    createdAt: nowIso(),
    createdByLabel: input.actorLabel,
    status: "submitted",
    priority: input.priority,
    remarks: input.remarks?.trim() || undefined,
    lines,
  };
  upsertStockRequest(row);

  // Vendor desk notification hook
  createNotification({
    moduleKey: "consignment",
    title: `Stock request (${row.priority}) from ${row.agentName}`,
    message: `${branch.name}: ${row.lines.length} item(s) requested.`,
    severity: row.priority === "urgent" ? "urgent" : "info",
    entityType: "agent_stock_request",
    entityId: row.id,
    branchId: input.stallBranchId,
    visibleToBranchManagers: true,
    visibleToSysAdmin: true,
    requiresAcknowledgement: false,
    metadata: { stallBranchId: input.stallBranchId, agentId: input.agentId },
  });

  pushAgentNotification({
    severity: "info",
    title: "Stock request submitted",
    message: "Your request has been sent to the vendor desk for review.",
    metadata: { stockRequestId: row.id },
  });

  return { ok: true, request: row };
}

