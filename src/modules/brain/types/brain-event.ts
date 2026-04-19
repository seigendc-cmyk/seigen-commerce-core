/**
 * Brain Event Foundation — standard envelope for operational memory.
 * Immutable facts table; rules/alerts/scores attach later.
 */

export type BrainActorType = "user" | "system" | "integration";

/** Rough ordering for routing and Console filters; not a business SLA yet. */
export type BrainEventSeverity = "debug" | "info" | "notice" | "warning" | "error" | "critical";

/**
 * Canonical event names (module.namespace.action).
 * Add new constants as emitters go live.
 */
export const BrainEventTypes = {
  POS_SALE_COMPLETED: "pos.sale.completed",
} as const;

export type BrainEventType = (typeof BrainEventTypes)[keyof typeof BrainEventTypes];

export type BrainEventEnvelope = {
  /** Stable logical name, e.g. pos.sale.completed */
  eventType: string;
  /** Product area: pos, inventory, delivery, … */
  module: string;
  tenantId: string | null;
  branchId: string | null;
  actorId: string | null;
  actorType: BrainActorType;
  entityType: string;
  entityId: string;
  occurredAt: string;
  severity: BrainEventSeverity;
  correlationId: string | null;
  /** Domain-specific snapshot; keep bounded in size */
  payload: Record<string, unknown>;
};

export type PosSaleCompletedPayload = {
  receiptNumber: string;
  saleId: string;
  branchId: string;
  status: string;
  subtotal: number;
  deliveryFee: number;
  amountDue: number;
  totalPaid: number;
  changeDue: number;
  lineCount: number;
  lines: Array<{
    productId: string;
    sku: string;
    name: string;
    qty: number;
    lineTotal: number;
  }>;
  payments: Array<{ method: string; amount: number }>;
  ideliverProviderId: string | null;
};
