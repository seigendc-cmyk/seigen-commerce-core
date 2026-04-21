import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";
import type { Id } from "@/modules/inventory/types/models";
import { listRemittances, listSales, listShifts, upsertShift } from "./agent-storage";
import type { AgentShift } from "../types/agent";

function uid(p: string): string {
  return `${p}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}
function nowIso(): string {
  return new Date().toISOString();
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function openShift(input: {
  stallBranchId: Id;
  agentId: string;
  agentName: string;
  actorLabel: string;
  openingCash?: number;
  openingNote?: string;
}): { ok: true; shift: AgentShift } | { ok: false; error: string } {
  const branch = InventoryRepo.getBranch(input.stallBranchId);
  if (!branch) return { ok: false, error: "Stall branch not found." };

  const openExisting = listOpenShiftForStall(input.stallBranchId);
  if (openExisting) return { ok: false, error: "A shift is already open for this stall." };

  const s: AgentShift = {
    id: uid("shift"),
    stallBranchId: input.stallBranchId,
    stallName: branch.name,
    agentId: input.agentId,
    agentName: input.agentName,
    openedAt: nowIso(),
    openedByLabel: input.actorLabel,
    openingCash: input.openingCash != null ? round2(Math.max(0, input.openingCash)) : undefined,
    openingNote: input.openingNote?.trim() || undefined,
    status: "open",
  };
  upsertShift(s);
  return { ok: true, shift: s };
}

export function closeShift(input: { shiftId: string; actorLabel: string; closingNote?: string }): { ok: true; shift: AgentShift } | { ok: false; error: string } {
  const s = listShifts().find((x) => x.id === input.shiftId);
  if (!s) return { ok: false, error: "Shift not found." };
  if (s.status !== "open") return { ok: false, error: "Shift is not open." };

  const sales = listSales().filter((x) => x.shiftId === s.id && x.status === "completed");
  const salesTotal = round2(sales.reduce((t, x) => t + x.subtotal, 0));
  const expectedCash = round2(sales.filter((x) => x.paymentMethod === "cash").reduce((t, x) => t + x.amountPaid, 0));
  const remittedCash = round2(
    listRemittances()
      .filter((r) => r.shiftId === s.id && (r.status === "received_approved" || r.status === "agent_confirmed"))
      .reduce((t, r) => t + r.amountDeclared, 0),
  );

  const next: AgentShift = {
    ...s,
    status: "closed",
    closedAt: nowIso(),
    closedByLabel: input.actorLabel,
    closingNote: input.closingNote?.trim() || undefined,
    salesTotal,
    expectedCash,
    remittedCash,
  };
  upsertShift(next);
  return { ok: true, shift: next };
}

export function listOpenShiftForStall(stallBranchId: Id): AgentShift | null {
  return listShifts().find((s) => s.stallBranchId === stallBranchId && s.status === "open") ?? null;
}

