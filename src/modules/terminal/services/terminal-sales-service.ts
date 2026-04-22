import { emitPosSaleCompletedBrainEventDurable } from "@/modules/brain/brain-outbox";
import type { Id } from "@/modules/inventory/types/models";
import { finalizeSale } from "@/modules/pos/services/sales-service";
import type { Cart, Payment, Sale } from "@/modules/pos/types/pos";
import { auditTerminalDesk } from "./terminal-audit-desk";

export type CompleteTerminalSaleInput = {
  cart: Cart;
  payments: Payment[] | Payment;
  branchId: Id;
  terminalProfileId: string;
  terminalSessionId: string;
  operatorLabel: string;
};

export type CompleteTerminalSaleResult = { ok: true; sale: Sale } | { ok: false; error: string };

export function completeTerminalSale(input: CompleteTerminalSaleInput): CompleteTerminalSaleResult {
  if (!input.terminalSessionId.trim()) return { ok: false, error: "Terminal session is required." };
  const result = finalizeSale(input.cart, input.payments, {
    branchId: input.branchId,
    surface: "terminal",
    terminalProfileId: input.terminalProfileId,
  });
  if (!result.ok) return result;

  const { sale } = result;
  const correlationId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `corr_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  auditTerminalDesk({
    action: "terminal.sale.completed",
    actorLabel: input.operatorLabel,
    entityType: "sale",
    entityId: sale.id,
    correlationId,
    afterState: {
      receiptNumber: sale.receiptNumber,
      branchId: sale.branchId,
      terminalProfileId: input.terminalProfileId,
      terminalSessionId: input.terminalSessionId,
    },
  });

  void emitPosSaleCompletedBrainEventDurable({
    sale,
    correlationId,
    payloadExtras: { terminalSessionId: input.terminalSessionId },
  });

  return { ok: true, sale };
}
