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
  POS_SALE_VOIDED: "pos.sale.voided",
  POS_RECEIPT_REPRINTED: "pos.receipt.reprinted",
  POS_SALE_RETURNED: "pos.sale.returned",
  TERMINAL_SHIFT_OPENED: "terminal.shift.opened",
  TERMINAL_SHIFT_CLOSED: "terminal.shift.closed",
  TERMINAL_CASH_MOVEMENT_RECORDED: "terminal.cash.movement.recorded",
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

  // -----------------------------
  // Consignment BI event stream (Pack: Consignment BI integration)
  // -----------------------------
  CONSIGNMENT_STOCK_ISSUED: "consignment.stock.issued",
  CONSIGNMENT_STOCK_RECEIVED: "consignment.stock.received",
  CONSIGNMENT_STOCK_SOLD: "consignment.stock.sold",
  CONSIGNMENT_STOCK_RETURNED: "consignment.stock.returned",
  CONSIGNMENT_STOCK_DAMAGED: "consignment.stock.damaged",
  CONSIGNMENT_STOCK_MISSING: "consignment.stock.missing",
  CONSIGNMENT_SETTLEMENT_CREATED: "consignment.settlement.created",
  CONSIGNMENT_SETTLEMENT_PAID: "consignment.settlement.paid",
  CONSIGNMENT_SETTLEMENT_OVERDUE: "consignment.settlement.overdue",
  CONSIGNMENT_RECONCILIATION_PERFORMED: "consignment.reconciliation.performed",
  CONSIGNMENT_RECONCILIATION_SUBMITTED: "consignment.reconciliation.submitted",
  CONSIGNMENT_DOCUMENT_VALIDATED: "consignment.document.validated",
  CONSIGNMENT_EVIDENCE_GAP: "consignment.evidence.gap",
  CONSIGNMENT_DISPUTE_CREATED: "consignment.dispute.created",

  // -----------------------------
  // Market Space + iTred (public discovery; BI-observable)
  // -----------------------------
  MARKET_SPACE_HOME_VIEWED: "market_space.home.viewed",
  MARKET_SPACE_LISTINGS_SEARCHED: "market_space.listings.searched",
  MARKET_SPACE_LISTING_VIEWED: "market_space.listing.viewed",
  MARKET_SPACE_VENDOR_VIEWED: "market_space.vendor.viewed",
  MARKET_SPACE_STOREFRONT_OPENED: "market_space.storefront.opened",
  ITRED_SEARCH_PERFORMED: "itred.search.performed",
  ITRED_RESULT_CLICKED: "itred.result.clicked",
  LISTING_PUBLISH_REQUESTED: "listing.publish.requested",
  LISTING_PUBLISH_SUCCEEDED: "listing.publish.succeeded",
  LISTING_PUBLISH_FAILED: "listing.publish.failed",
  LISTING_UNPUBLISHED: "listing.unpublished",
  LISTING_SUSPENDED: "listing.suspended",
  LISTING_PRICE_CHANGED: "listing.price.changed",
  LISTING_STOCK_VISIBILITY_CHANGED: "listing.stock.visibility.changed",
  LISTING_GEO_UPDATED: "listing.geo.updated",
  LISTING_STOREFRONT_CHANGED: "listing.storefront.changed",
  LISTING_GEO_MISS_DETECTED: "listing.geo.miss_detected",
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

/**
 * Consignment BI event payloads are normalized and always include these fields:
 * tenant_id, principal_vendor_id, agent_id, consignment_id, product_id, quantity, value, occurred_at, correlation_id, payload
 *
 * Note: `tenant_id` is also stored on the envelope row (`brain_events.tenant_id`) for indexing/RLS.
 */
export type ConsignmentBiEventBasePayload = {
  tenant_id: string;
  principal_vendor_id: string;
  agent_id: string;
  consignment_id: string;
  product_id: string | null;
  quantity: number | null;
  value: number | null;
  occurred_at: string;
  correlation_id: string;
  payload: Record<string, unknown>;
};

export type ConsignmentStockIssuedPayload = ConsignmentBiEventBasePayload & {
  event: "consignment.stock.issued";
  from_branch_id?: string | null;
  to_stall_branch_id?: string | null;
  issue_invoice_id?: string | null;
};

export type ConsignmentStockReceivedPayload = ConsignmentBiEventBasePayload & {
  event: "consignment.stock.received";
  receiving_document_id?: string | null;
};

export type ConsignmentStockSoldPayload = ConsignmentBiEventBasePayload & {
  event: "consignment.stock.sold";
  sale_id?: string | null;
  receipt_number?: string | null;
  stall_branch_id?: string | null;
  unit_price?: number | null;
  unit_cost?: number | null;
};

export type ConsignmentStockReturnedPayload = ConsignmentBiEventBasePayload & {
  event: "consignment.stock.returned";
  return_document_id?: string | null;
};

export type ConsignmentStockDamagedPayload = ConsignmentBiEventBasePayload & {
  event: "consignment.stock.damaged";
  report_document_id?: string | null;
};

export type ConsignmentStockMissingPayload = ConsignmentBiEventBasePayload & {
  event: "consignment.stock.missing";
  report_document_id?: string | null;
};

export type ConsignmentSettlementCreatedPayload = ConsignmentBiEventBasePayload & {
  event: "consignment.settlement.created";
  settlement_id: string;
  period_from?: string | null;
  period_to?: string | null;
};

export type ConsignmentSettlementPaidPayload = ConsignmentBiEventBasePayload & {
  event: "consignment.settlement.paid";
  settlement_id: string;
  payment_reference?: string | null;
};

export type ConsignmentSettlementOverduePayload = ConsignmentBiEventBasePayload & {
  event: "consignment.settlement.overdue";
  settlement_id: string;
  days_overdue?: number | null;
};

export type ConsignmentReconciliationPerformedPayload = ConsignmentBiEventBasePayload & {
  event: "consignment.reconciliation.performed";
  reconciliation_id: string;
  variance_qty?: number | null;
  variance_value?: number | null;
};

export type ConsignmentDisputeCreatedPayload = ConsignmentBiEventBasePayload & {
  event: "consignment.dispute.created";
  dispute_id: string;
  dispute_kind?: string | null;
};

export type ConsignmentReconciliationSubmittedPayload = ConsignmentBiEventBasePayload & {
  event: "consignment.reconciliation.submitted";
  reconciliation_id: string;
  discrepancy_count?: number | null;
};

export type ConsignmentDocumentValidatedPayload = ConsignmentBiEventBasePayload & {
  event: "consignment.document.validated";
  document_id: string;
  document_type: string;
  validation_status: string;
};

export type ConsignmentEvidenceGapPayload = ConsignmentBiEventBasePayload & {
  event: "consignment.evidence.gap";
  gap_codes: string[];
  reconciliation_id?: string | null;
  settlement_id?: string | null;
};

export const SAMPLE_CONSIGNMENT_BI_EVENT_PAYLOADS = {
  "consignment.stock.received": {
    event: "consignment.stock.received",
    tenant_id: "TENANT_UUID",
    principal_vendor_id: "TENANT_UUID",
    agent_id: "agent_branch_stall_001",
    consignment_id: "issue_invoice_ABC123",
    product_id: "prod_001",
    quantity: 10,
    value: 780,
    occurred_at: new Date().toISOString(),
    correlation_id: "corr_received_001",
    payload: { receiving_document_id: "GRN-0001", memo: "Stall confirmed receipt" },
  },
  "consignment.stock.issued": {
    event: "consignment.stock.issued",
    tenant_id: "TENANT_UUID",
    principal_vendor_id: "TENANT_UUID",
    agent_id: "agent_branch_stall_001",
    consignment_id: "issue_invoice_ABC123",
    product_id: "prod_001",
    quantity: 10,
    value: 780,
    occurred_at: new Date().toISOString(),
    correlation_id: "corr_issued_001",
    payload: { invoice_unit_cost: 78, principal_branch_id: "branch_main", stall_branch_id: "stall_001" },
  },
  "consignment.stock.sold": {
    event: "consignment.stock.sold",
    tenant_id: "TENANT_UUID",
    principal_vendor_id: "TENANT_UUID",
    agent_id: "agent_branch_stall_001",
    consignment_id: "issue_invoice_ABC123",
    product_id: "prod_001",
    quantity: 2,
    value: 156,
    occurred_at: new Date().toISOString(),
    correlation_id: "corr_sale_001",
    payload: { sale_id: "sale_001", receipt_number: "REC-0001", stall_branch_id: "stall_001" },
  },
  "consignment.stock.returned": {
    event: "consignment.stock.returned",
    tenant_id: "TENANT_UUID",
    principal_vendor_id: "TENANT_UUID",
    agent_id: "agent_branch_stall_001",
    consignment_id: "issue_invoice_ABC123",
    product_id: "prod_001",
    quantity: 1,
    value: 78,
    occurred_at: new Date().toISOString(),
    correlation_id: "corr_return_001",
    payload: { return_document_id: "RET-0001", condition: "good" },
  },
  "consignment.stock.damaged": {
    event: "consignment.stock.damaged",
    tenant_id: "TENANT_UUID",
    principal_vendor_id: "TENANT_UUID",
    agent_id: "agent_branch_stall_001",
    consignment_id: "issue_invoice_ABC123",
    product_id: "prod_001",
    quantity: 1,
    value: 78,
    occurred_at: new Date().toISOString(),
    correlation_id: "corr_damage_001",
    payload: { report_document_id: "DAM-0001", memo: "Broken packaging" },
  },
  "consignment.stock.missing": {
    event: "consignment.stock.missing",
    tenant_id: "TENANT_UUID",
    principal_vendor_id: "TENANT_UUID",
    agent_id: "agent_branch_stall_001",
    consignment_id: "issue_invoice_ABC123",
    product_id: "prod_001",
    quantity: 1,
    value: 78,
    occurred_at: new Date().toISOString(),
    correlation_id: "corr_missing_001",
    payload: { reference: "STKADJ-001", memo: "Shortage (stock adjustment)" },
  },
  "consignment.settlement.created": {
    event: "consignment.settlement.created",
    tenant_id: "TENANT_UUID",
    principal_vendor_id: "TENANT_UUID",
    agent_id: "agent_branch_stall_001",
    consignment_id: "agreement_CAG_001",
    product_id: null,
    quantity: null,
    value: 1250,
    occurred_at: new Date().toISOString(),
    correlation_id: "corr_settlement_created_001",
    payload: { settlement_id: "sett_001", period_from: "2026-04-01", period_to: "2026-04-07" },
  },
  "consignment.settlement.paid": {
    event: "consignment.settlement.paid",
    tenant_id: "TENANT_UUID",
    principal_vendor_id: "TENANT_UUID",
    agent_id: "agent_branch_stall_001",
    consignment_id: "agreement_CAG_001",
    product_id: null,
    quantity: null,
    value: 1250,
    occurred_at: new Date().toISOString(),
    correlation_id: "corr_settlement_paid_001",
    payload: { settlement_id: "sett_001", payment_reference: "BANKTRX-7788" },
  },
  "consignment.settlement.overdue": {
    event: "consignment.settlement.overdue",
    tenant_id: "TENANT_UUID",
    principal_vendor_id: "TENANT_UUID",
    agent_id: "agent_branch_stall_001",
    consignment_id: "agreement_CAG_001",
    product_id: null,
    quantity: null,
    value: 1250,
    occurred_at: new Date().toISOString(),
    correlation_id: "corr_settlement_overdue_001",
    payload: { settlement_id: "sett_001", days_overdue: 3 },
  },
  "consignment.reconciliation.performed": {
    event: "consignment.reconciliation.performed",
    tenant_id: "TENANT_UUID",
    principal_vendor_id: "TENANT_UUID",
    agent_id: "agent_branch_stall_001",
    consignment_id: "agreement_CAG_001",
    product_id: null,
    quantity: null,
    value: null,
    occurred_at: new Date().toISOString(),
    correlation_id: "corr_recon_001",
    payload: { reconciliation_id: "recon_001", variance_qty: -2, variance_value: -156 },
  },
  "consignment.dispute.created": {
    event: "consignment.dispute.created",
    tenant_id: "TENANT_UUID",
    principal_vendor_id: "TENANT_UUID",
    agent_id: "agent_branch_stall_001",
    consignment_id: "agreement_CAG_001",
    product_id: null,
    quantity: null,
    value: null,
    occurred_at: new Date().toISOString(),
    correlation_id: "corr_dispute_001",
    payload: { dispute_id: "disp_001", dispute_kind: "missing_stock", memo: "Agent disputes shortage valuation" },
  },
} as const;

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
