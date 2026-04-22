import type { Id } from "@/modules/inventory/types/models";

export type TerminalPortalType = "cashier" | "agent" | "supervisor";

export type TerminalProfile = {
  id: string;
  /** Browser-local profiles use `"local"` until Supabase-backed sync exists. */
  tenantId: string;
  terminalCode: string;
  userId: string | null;
  branchId: Id;
  stallId: Id | null;
  role: string;
  portalType: TerminalPortalType;
  isActive: boolean;
  requiresPin: boolean;
  pinHash: string | null;
  permissions: string[];
  operatorLabel: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type TerminalSessionStatus = "active" | "ended" | "revoked";

export type TerminalSession = {
  id: string;
  tenantId: string;
  terminalProfileId: string;
  userId: string | null;
  branchId: Id;
  stallId: Id | null;
  startedAt: string;
  endedAt: string | null;
  sessionStatus: TerminalSessionStatus;
  /** Snapshot of trusted permissions at session start (reduces drift during active session). */
  permissionsSnapshot?: string[];
  /** Profile updatedAt value at session start; mismatch implies local profile changed. */
  profileUpdatedAtSnapshot?: string;
  terminalCodeSnapshot?: string;
  operatorLabelSnapshot?: string;
  roleSnapshot?: string;
  portalTypeSnapshot?: TerminalPortalType;
  /** "pin" when PIN gate used, otherwise "code". */
  authStrength?: "code" | "pin";
  /** When the session should be considered expired (local safety timeout). */
  expiresAt?: string | null;
  deviceInfo: Record<string, unknown>;
  lastSeenAt: string;
};

export type TerminalShiftStatus = "open" | "closed";

export type TerminalShift = {
  id: string;
  terminalProfileId: string;
  branchId: Id;
  sessionId: string;
  status: TerminalShiftStatus;
  openingFloat: number;
  /**
   * Expected cash at close for this shift (openingFloat + cash takings - cash change).
   * Stored as snapshot to support drift review later.
   */
  expectedCashAtClose?: number | null;
  closingCount: number | null;
  /** closingCount - expectedCashAtClose (positive means over, negative short). */
  cashVariance?: number | null;
  /** Operator reason when variance exists (required by UI when variance is non-trivial). */
  cashVarianceReason?: string | null;
  openedAt: string;
  closedAt: string | null;
};

export type TerminalCashMovementKind = "cash_in" | "cash_out" | "paid_out";

export type TerminalCashMovement = {
  id: string;
  tenantId: string;
  terminalProfileId: string;
  branchId: Id;
  shiftId: string;
  kind: TerminalCashMovementKind;
  amount: number;
  memo: string;
  operatorLabel: string;
  createdAt: string;
};

export const TERMINAL_PERMISSION_KEYS = [
  "terminal.sale.create",
  "terminal.sale.discount",
  "terminal.sale.price_override",
  "terminal.sale.return",
  "terminal.sale.void",
  "terminal.receipt.reprint",
  "terminal.shift.open",
  "terminal.shift.close",
  "terminal.cash.movement",
  "terminal.cash.remit",
  "terminal.profile.manage",
] as const;

export type TerminalPermissionKey = (typeof TERMINAL_PERMISSION_KEYS)[number];

export const DEFAULT_CASHIER_TERMINAL_PERMISSIONS: TerminalPermissionKey[] = [
  "terminal.sale.create",
  "terminal.shift.open",
  "terminal.shift.close",
  "terminal.receipt.reprint",
];
