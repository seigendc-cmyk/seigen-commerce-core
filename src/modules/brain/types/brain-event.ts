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
  /** COGS Reserves used to settle supplier AP — notify finance / managers (Brain + optional email later). */
  CASHPLAN_CREDITOR_PAYMENT: "cashplan.creditor.payment",
  /** Missed AP/AR: user proposed a new payment/collection date — requires approval before schedule updates. */
  CASHPLAN_SCHEDULE_CHANGE_REQUESTED: "cashplan.schedule.change.requested",
  /** Schedule request approved or rejected (audit + notifications). */
  CASHPLAN_SCHEDULE_CHANGE_RESOLVED: "cashplan.schedule.change.resolved",
  /** Vendor opened a CashPlan discipline reserve (rent, tax, salaries, etc.). */
  CASHPLAN_RESERVE_CREATED: "cashplan.reserve.created",
  /** Funding movement into a CashPlan reserve (earmark from free-cash view). */
  CASHPLAN_RESERVE_FUNDED: "cashplan.reserve.funded",
  /** Withdrawal, release, or metadata change queued for approval. */
  CASHPLAN_RESERVE_APPROVAL_REQUESTED: "cashplan.reserve.approval.requested",
  /** Reserve approval queue item approved or rejected. */
  CASHPLAN_RESERVE_APPROVAL_RESOLVED: "cashplan.reserve.approval.resolved",
  /** Consignment agreement submitted for approval (no operational provisioning until approved). */
  CONSIGNMENT_AGREEMENT_APPROVAL_REQUESTED: "consignment.agreement.approval.requested",
  /** Consignment agreement approval resolved (approved/rejected). */
  CONSIGNMENT_AGREEMENT_APPROVAL_RESOLVED: "consignment.agreement.approval.resolved",
  /** One-time agent access code issued for provisioning (do not store raw code in Brain). */
  CONSIGNMENT_AGENT_ACCESS_CODE_ISSUED: "consignment.agent.access_code.issued",
  /** One-time agent access code redeemed/claimed (do not store raw code in Brain). */
  CONSIGNMENT_AGENT_ACCESS_CODE_REDEEMED: "consignment.agent.access_code.redeemed",
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
