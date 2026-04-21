import type { Id } from "@/modules/inventory/types/models";
import type { CartItem } from "@/modules/pos/types/pos";

export type AgentShiftStatus = "open" | "closed" | "cancelled";

export type AgentShift = {
  id: string;
  stallBranchId: Id;
  stallName: string;
  agentId: string;
  agentName: string;
  openedAt: string;
  openedByLabel: string;
  openingCash?: number;
  openingNote?: string;
  closedAt?: string;
  closedByLabel?: string;
  closingNote?: string;
  status: AgentShiftStatus;
  /** Derived snapshots at close time */
  salesTotal?: number;
  expectedCash?: number;
  remittedCash?: number;
};

export type AgentSaleStatus = "completed" | "voided";

export type AgentSale = {
  id: string;
  stallBranchId: Id;
  shiftId: string | null;
  createdAt: string;
  createdByLabel: string;
  status: AgentSaleStatus;
  items: CartItem[];
  subtotal: number;
  amountPaid: number;
  paymentMethod: "cash" | "momo" | "bank_transfer";
  customerLabel?: string;
};

export type AgentStockRequestStatus = "submitted" | "cancelled" | "fulfilled_partial" | "fulfilled";

export type AgentStockRequestLine = {
  id: string;
  productId: Id;
  sku: string;
  productName: string;
  requestedQty: number;
};

export type AgentStockRequest = {
  id: string;
  stallBranchId: Id;
  agentId: string;
  agentName: string;
  createdAt: string;
  createdByLabel: string;
  status: AgentStockRequestStatus;
  priority: "normal" | "urgent";
  remarks?: string;
  lines: AgentStockRequestLine[];
};

export type AgentCashRemittanceStatus =
  | "draft"
  | "submitted"
  | "pending_pop_review"
  | "pop_rejected"
  | "pop_accepted_pending_confirmation"
  | "received_approved"
  | "agent_confirmed"
  | "cancelled";

export type AgentCashRemittance = {
  id: string;
  remittanceNumber: string;
  createdAt: string;
  createdByLabel: string;
  stallBranchId: Id;
  stallName: string;
  agentId: string;
  agentName: string;
  shiftId: string | null;
  amountDeclared: number;
  paymentChannel: "cash_deposit" | "bank_transfer" | "mobile_money";
  destinationLabel: string;
  popReference: string;
  popImageDataUrl?: string;
  notes?: string;
  status: AgentCashRemittanceStatus;
  submittedAt?: string;
  approvedAt?: string;
  approvedByLabel?: string;
  rejectedAt?: string;
  rejectedByLabel?: string;
  rejectionReason?: string;
  journalBatchId?: string;
  agentConfirmedAt?: string;
};

export type AgentNotification = {
  id: string;
  createdAt: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  action?: { label: string; href: string };
  readAt?: string | null;
  metadata?: Record<string, unknown>;
};

