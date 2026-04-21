import type { Id } from "@/modules/inventory/types/models";

/**
 * Formal commercial document: stock issued from the principal vendor warehouse into the Agent stall
 * branch (same vendor core database). The Agent stall operates like a branch-like selling unit; stock
 * must not be sellable at the stall until this invoice is approved and posted.
 */
export type ConsignmentIssueInvoiceStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "cancelled";

export type ConsignmentIssueInvoiceLine = {
  id: string;
  productId: Id;
  sku: string;
  productName: string;
  quantity: number;
  /** Cost / issue value basis per unit (commercial invoice line). */
  unitIssueValue: number;
  /** Optional selling basis note for margin governance. */
  sellingBasisNote?: string;
  lineTotal: number;
};

export type ConsignmentIssueInvoice = {
  id: string;
  /** Human-readable document number (unique per tenant deployment in local store). */
  documentNumber: string;
  invoiceDate: string;
  /** Principal vendor context — in multi-tenant SaaS this would be tenant id; here echoed for clarity. */
  principalTenantLabel?: string;
  /** Warehouse / branch issuing stock (vendor core). */
  issuingBranchId: Id;
  issuingBranchName: string;
  /** Target agent stall — branch-like unit under same vendor DB. */
  agentStallBranchId: Id;
  agentStallName: string;
  agentId: string;
  agentName: string;
  agreementId: string;
  agreementReference?: string;
  status: ConsignmentIssueInvoiceStatus;
  lines: ConsignmentIssueInvoiceLine[];
  totalValue: number;
  pricingBasisNote?: string;
  remarks?: string;
  createdAt: string;
  createdByLabel: string;
  updatedAt: string;
  updatedByLabel?: string;
  submittedAt?: string;
  submittedByLabel?: string;
  approvedAt?: string;
  approvedByLabel?: string;
  rejectedAt?: string;
  rejectedByLabel?: string;
  rejectionReason?: string;
  cancelledAt?: string;
  cancelledByLabel?: string;
  /** Links to accounting + stock artefacts (browser-local financial / custody ledgers). */
  journalBatchId?: string;
  custodyEntryIds?: string[];
  /** When status is pending_approval, principal stock has been reserved (deducted from issuing branch). */
  principalStockReserved?: boolean;
};

export type ConsignmentIssueInvoiceAuditEntry = {
  id: string;
  invoiceId: string;
  at: string;
  actorLabel: string;
  action:
    | "created"
    | "updated"
    | "submitted"
    | "approved"
    | "rejected"
    | "cancelled"
    | "stock_posted"
    | "journal_posted";
  detail?: string;
  metadata?: Record<string, unknown>;
};
