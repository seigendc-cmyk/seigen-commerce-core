import { browserLocalJson } from "@/modules/inventory/services/storage";
import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";
import { appendBalancedJournalWithLedgers, COA_CASH_CODE, COA_BANK_CODE } from "@/modules/financial/services/general-journal-ledger";

const NS = { namespace: "seigen.cashplan", version: 1 as const };

export const CASHPLAN_RESERVES_UPDATED = "seigen-cashplan-reserves-updated";

export type ReservePriority = "low" | "medium" | "high" | "critical";

export type ReserveHealth = "healthy" | "underfunded" | "at_risk" | "on_track";

export type ReserveStatus = "draft" | "active" | "paused" | "funded" | "in_use" | "completed" | "closed";

export type ReservePurposeMode = "strict" | "flexible";

export type ReserveFundingSourceKind = "cash_book" | "bank" | "manual_topup" | "reserve_transfer";
export type ReserveFundingDestinationKind = "cash_book" | "bank" | "procurement_payment" | "manual" | "reserve_transfer";

export type ReserveAllotmentLine = {
  id: string;
  title: string;
  plannedAmount: number;
  fundedAmount: number;
  spentAmount: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type CashPlanReserveAccount = {
  id: string;
  branchId: string;
  name: string;
  purpose: string;
  purposeMode: ReservePurposeMode;
  targetAmount: number | null;
  dueDate: string | null;
  priority: ReservePriority;
  notes: string;
  status: ReserveStatus;
  balance: number;
  /** Structured budget (allotments) */
  allotments: ReserveAllotmentLine[];
  createdAt: string;
  updatedAt: string;
  lastDepositAt: string | null;
  lastWithdrawalAt: string | null;
  lastChangedByLabel: string;
};

export type ReserveMovementKind =
  | "deposit"
  | "withdrawal"
  | "adjustment"
  | "transfer_in"
  | "transfer_out"
  | "release_to_free_cash"
  | "full_use";

export type ReserveMovement = {
  id: string;
  reserveId: string;
  createdAt: string;
  kind: ReserveMovementKind;
  /** Signed: positive increases reserve, negative decreases. */
  amount: number;
  balanceAfter: number;
  memo: string;
  actorLabel: string;
  sourceKind?: ReserveFundingSourceKind;
  sourceRef?: string;
  destinationKind?: ReserveFundingDestinationKind;
  destinationRef?: string;
  allotmentLineId?: string;
  journalBatchId?: string;
  peerReserveId?: string;
  approvalRequestId?: string;
};

export type ReserveApprovalKind = "withdrawal" | "release_to_free_cash" | "transfer_out" | "metadata_edit";

export type ReserveApprovalRequest = {
  id: string;
  status: "pending" | "approved" | "rejected";
  kind: ReserveApprovalKind;
  reserveId: string;
  reserveName: string;
  branchId: string;
  amount?: number;
  targetReserveId?: string;
  targetReserveName?: string;
  newTargetAmount?: number | null;
  newDueDate?: string | null;
  newPurpose?: string;
  reason: string;
  requestedByLabel: string;
  createdAt: string;
  resolvedAt?: string;
};

export type ReserveBehaviorSignal = {
  id: string;
  createdAt: string;
  kind: string;
  message: string;
  reserveId?: string;
  severity: "info" | "warning";
};

type AccountsDb = { accounts: CashPlanReserveAccount[] };
type MovementsDb = { entries: ReserveMovement[] };
type QueueDb = { requests: ReserveApprovalRequest[] };
type BehaviorDb = { signals: ReserveBehaviorSignal[] };

export const COA_RESERVE_CONTROL_CODE = "1035";
export const RESERVE_LARGE_WITHDRAWAL_THRESHOLD = 1000;

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function uid(p: string): string {
  return `${p}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function getAccountsDb(): AccountsDb {
  const store = browserLocalJson(NS);
  if (!store) return { accounts: [] };
  return store.read<AccountsDb>("reserve_accounts", { accounts: [] });
}

function setAccountsDb(db: AccountsDb) {
  const store = browserLocalJson(NS);
  if (!store) return;
  store.write("reserve_accounts", db);
}

function getMovementsDb(): MovementsDb {
  const store = browserLocalJson(NS);
  if (!store) return { entries: [] };
  return store.read<MovementsDb>("reserve_movements", { entries: [] });
}

function setMovementsDb(db: MovementsDb) {
  const store = browserLocalJson(NS);
  if (!store) return;
  store.write("reserve_movements", db);
}

function getQueueDb(): QueueDb {
  const store = browserLocalJson(NS);
  if (!store) return { requests: [] };
  return store.read<QueueDb>("reserve_approval_queue", { requests: [] });
}

function setQueueDb(db: QueueDb) {
  const store = browserLocalJson(NS);
  if (!store) return;
  store.write("reserve_approval_queue", db);
}

function getBehaviorDb(): BehaviorDb {
  const store = browserLocalJson(NS);
  if (!store) return { signals: [] };
  return store.read<BehaviorDb>("reserve_behavior_signals", { signals: [] });
}

function setBehaviorDb(db: BehaviorDb) {
  const store = browserLocalJson(NS);
  if (!store) return;
  store.write("reserve_behavior_signals", db);
}

function notifyReservesUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CASHPLAN_RESERVES_UPDATED));
}

export function cashPlanReserveAccountsStorageKey(): string {
  const store = browserLocalJson(NS);
  return store?.fullKey("reserve_accounts") ?? "seigen.cashplan:v1:reserve_accounts";
}

export function cashPlanReserveMovementsStorageKey(): string {
  const store = browserLocalJson(NS);
  return store?.fullKey("reserve_movements") ?? "seigen.cashplan:v1:reserve_movements";
}

export function cashPlanReserveQueueStorageKey(): string {
  const store = browserLocalJson(NS);
  return store?.fullKey("reserve_approval_queue") ?? "seigen.cashplan:v1:reserve_approval_queue";
}

export function listReserveAccounts(): CashPlanReserveAccount[] {
  return getAccountsDb()
    .accounts.slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getReserveAccount(id: string): CashPlanReserveAccount | undefined {
  return getAccountsDb().accounts.find((a) => a.id === id);
}

export function totalCashPlanReserveBalances(): number {
  const sum = getAccountsDb().accounts.reduce((s, a) => s + a.balance, 0);
  return roundMoney(sum);
}

export function listReserveMovements(reserveId: string, limit = 100): ReserveMovement[] {
  return getMovementsDb()
    .entries.filter((e) => e.reserveId === reserveId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export function listAllReserveMovements(limit = 300): ReserveMovement[] {
  return getMovementsDb()
    .entries.slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

function appendMovement(m: Omit<ReserveMovement, "id" | "createdAt">): ReserveMovement {
  const row: ReserveMovement = {
    id: uid("rm"),
    createdAt: new Date().toISOString(),
    ...m,
  };
  const db = getMovementsDb();
  db.entries.push(row);
  setMovementsDb(db);
  return row;
}

function appendBehaviorSignal(kind: string, message: string, reserveId?: string, severity: "info" | "warning" = "info") {
  const db = getBehaviorDb();
  db.signals.unshift({
    id: uid("rbs"),
    createdAt: new Date().toISOString(),
    kind,
    message,
    reserveId,
    severity,
  });
  db.signals = db.signals.slice(0, 200);
  setBehaviorDb(db);
}

export function listReserveBehaviorSignals(limit = 50): ReserveBehaviorSignal[] {
  return getBehaviorDb().signals.slice(0, limit);
}

function reserveHealth(a: CashPlanReserveAccount): ReserveHealth {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (a.targetAmount != null && a.targetAmount > 0) {
    const ratio = a.balance / a.targetAmount;
    if (a.dueDate) {
      const due = new Date(a.dueDate + "T12:00:00");
      const days = (due.getTime() - today.getTime()) / (86400 * 1000);
      if (days <= 7 && days >= 0 && ratio < 0.5) return "at_risk";
    }
    if (ratio < 1) return "underfunded";
    return "healthy";
  }
  if (a.dueDate) {
    const due = new Date(a.dueDate + "T12:00:00");
    const days = (due.getTime() - today.getTime()) / (86400 * 1000);
    if (days <= 7 && days >= 0 && a.balance <= 0) return "at_risk";
  }
  return "on_track";
}

export function reserveAccountWithHealth(a: CashPlanReserveAccount): CashPlanReserveAccount & {
  health: ReserveHealth;
  amountStillNeeded: number | null;
} {
  const health = reserveHealth(a);
  const amountStillNeeded =
    a.targetAmount != null && a.targetAmount > 0 ? roundMoney(Math.max(0, a.targetAmount - a.balance)) : null;
  return { ...a, health, amountStillNeeded };
}

export function countReservesUnderfunded(): number {
  let n = 0;
  for (const a of listReserveAccounts()) {
    if (reserveHealth(a) === "underfunded" || reserveHealth(a) === "at_risk") n++;
  }
  return n;
}

export function countReservesDueWithinDays(days: number): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limit = today.getTime() + days * 86400000;
  let n = 0;
  for (const a of listReserveAccounts()) {
    if (!a.dueDate) continue;
    const due = new Date(a.dueDate + "T12:00:00").getTime();
    if (due >= today.getTime() && due <= limit) n++;
  }
  return n;
}

export function createReserveAccount(input: {
  name: string;
  purpose: string;
  purposeMode?: ReservePurposeMode;
  targetAmount: number | null;
  dueDate: string | null;
  priority: ReservePriority;
  notes: string;
  actorLabel: string;
  branchId?: string;
}): CashPlanReserveAccount {
  const branch = input.branchId ?? InventoryRepo.getDefaultBranch().id;
  const ts = new Date().toISOString();
  const actor = input.actorLabel.trim() || "User";
  const row: CashPlanReserveAccount = {
    id: uid("res"),
    branchId: branch,
    name: input.name.trim() || "Reserve",
    purpose: input.purpose.trim() || "Commitment",
    purposeMode: input.purposeMode === "flexible" ? "flexible" : "strict",
    targetAmount:
      input.targetAmount != null && Number.isFinite(input.targetAmount) && input.targetAmount > 0
        ? roundMoney(input.targetAmount)
        : null,
    dueDate: input.dueDate?.trim() ? input.dueDate.trim().slice(0, 10) : null,
    priority: input.priority,
    notes: input.notes.trim(),
    status: "active",
    balance: 0,
    allotments: [],
    createdAt: ts,
    updatedAt: ts,
    lastDepositAt: null,
    lastWithdrawalAt: null,
    lastChangedByLabel: actor,
  };
  const db = getAccountsDb();
  db.accounts.push(row);
  setAccountsDb(db);
  appendBehaviorSignal("reserve_created", `Reserve opened: ${row.name} (${row.purpose})`, row.id, "info");
  notifyReservesUpdated();
  return row;
}

export function fundReserve(input: {
  reserveId: string;
  amount: number;
  memo: string;
  actorLabel: string;
  sourceKind?: ReserveFundingSourceKind;
  sourceRef?: string;
}): { ok: true; account: CashPlanReserveAccount } | { ok: false; error: string } {
  const amt = roundMoney(input.amount);
  if (amt <= 0) return { ok: false, error: "Enter a positive amount." };
  const db = getAccountsDb();
  const a = db.accounts.find((x) => x.id === input.reserveId);
  if (!a) return { ok: false, error: "Reserve not found." };
  const actor = input.actorLabel.trim() || "User";

  // Accounting: move from cash/bank into reserve control.
  const src = input.sourceKind ?? "cash_book";
  const memo = input.memo.trim() || "Reserve funding";
  const lines =
    src === "bank"
      ? [
          { accountCode: COA_RESERVE_CONTROL_CODE, accountName: "Reserve control", debit: amt, credit: 0 },
          { accountCode: COA_BANK_CODE, accountName: "Bank", debit: 0, credit: amt },
        ]
      : src === "manual_topup"
        ? [
            { accountCode: COA_RESERVE_CONTROL_CODE, accountName: "Reserve control", debit: amt, credit: 0 },
            { accountCode: "9999", accountName: "Manual funding source", debit: 0, credit: amt },
          ]
        : [
            { accountCode: COA_RESERVE_CONTROL_CODE, accountName: "Reserve control", debit: amt, credit: 0 },
            { accountCode: COA_CASH_CODE, accountName: "Cashbook", debit: 0, credit: amt },
          ];
  const jr = appendBalancedJournalWithLedgers({
    memo: `${memo} · ${a.name}`,
    source: "journal",
    lines,
    cashCode: COA_CASH_CODE,
    bankCode: COA_BANK_CODE,
    preparedBy: actor,
  });
  if (!jr.ok) return { ok: false, error: jr.error };

  a.balance = roundMoney(a.balance + amt);
  a.updatedAt = new Date().toISOString();
  a.lastDepositAt = a.updatedAt;
  a.lastChangedByLabel = actor;
  if (a.status === "draft") a.status = "active";
  if (a.targetAmount != null && a.targetAmount > 0 && a.balance + 1e-9 >= a.targetAmount) a.status = "funded";
  setAccountsDb(db);
  appendMovement({
    reserveId: a.id,
    kind: "deposit",
    amount: amt,
    balanceAfter: a.balance,
    memo,
    actorLabel: actor,
    sourceKind: src,
    sourceRef: input.sourceRef?.trim() || undefined,
    journalBatchId: jr.batch.id,
  });
  appendBehaviorSignal("reserve_funded", `Funded ${a.name}: ${amt.toFixed(2)}`, a.id, "info");
  notifyReservesUpdated();
  return { ok: true, account: a };
}

export function addReserveAllotmentLine(input: {
  reserveId: string;
  title: string;
  plannedAmount: number;
  notes?: string;
  actorLabel: string;
}): { ok: true; account: CashPlanReserveAccount } | { ok: false; error: string } {
  const db = getAccountsDb();
  const a = db.accounts.find((x) => x.id === input.reserveId);
  if (!a) return { ok: false, error: "Reserve not found." };
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Line title required." };
  const planned = roundMoney(Math.max(0, Number(input.plannedAmount)));
  const ts = new Date().toISOString();
  a.allotments.push({
    id: uid("ral"),
    title,
    plannedAmount: planned,
    fundedAmount: 0,
    spentAmount: 0,
    notes: input.notes?.trim() || undefined,
    createdAt: ts,
    updatedAt: ts,
  });
  a.updatedAt = ts;
  a.lastChangedByLabel = input.actorLabel.trim() || "User";
  setAccountsDb(db);
  notifyReservesUpdated();
  return { ok: true, account: a };
}

export function updateReserveAllotmentLine(input: {
  reserveId: string;
  lineId: string;
  patch: Partial<Pick<ReserveAllotmentLine, "title" | "plannedAmount" | "notes">>;
  actorLabel: string;
}): { ok: true } | { ok: false; error: string } {
  const db = getAccountsDb();
  const a = db.accounts.find((x) => x.id === input.reserveId);
  if (!a) return { ok: false, error: "Reserve not found." };
  const ln = a.allotments.find((x) => x.id === input.lineId);
  if (!ln) return { ok: false, error: "Allotment line not found." };
  if (input.patch.title != null) ln.title = input.patch.title.trim() || ln.title;
  if (input.patch.plannedAmount != null) ln.plannedAmount = roundMoney(Math.max(0, Number(input.patch.plannedAmount)));
  if (input.patch.notes != null) ln.notes = input.patch.notes.trim() || undefined;
  ln.updatedAt = new Date().toISOString();
  a.updatedAt = ln.updatedAt;
  a.lastChangedByLabel = input.actorLabel.trim() || "User";
  setAccountsDb(db);
  notifyReservesUpdated();
  return { ok: true };
}

export function removeReserveAllotmentLine(input: { reserveId: string; lineId: string; actorLabel: string }): { ok: true } | { ok: false; error: string } {
  const db = getAccountsDb();
  const a = db.accounts.find((x) => x.id === input.reserveId);
  if (!a) return { ok: false, error: "Reserve not found." };
  const idx = a.allotments.findIndex((x) => x.id === input.lineId);
  if (idx < 0) return { ok: false, error: "Allotment line not found." };
  if ((a.allotments[idx]!.spentAmount ?? 0) > 1e-9) return { ok: false, error: "Cannot remove a line with spend history." };
  a.allotments.splice(idx, 1);
  a.updatedAt = new Date().toISOString();
  a.lastChangedByLabel = input.actorLabel.trim() || "User";
  setAccountsDb(db);
  notifyReservesUpdated();
  return { ok: true };
}

export function transferBetweenReserves(input: {
  fromReserveId: string;
  toReserveId: string;
  amount: number;
  memo: string;
  actorLabel: string;
}): { ok: true } | { ok: false; error: string } {
  if (input.fromReserveId === input.toReserveId) return { ok: false, error: "Choose two different reserves." };
  const amt = roundMoney(input.amount);
  if (amt <= 0) return { ok: false, error: "Enter a positive amount." };
  const db = getAccountsDb();
  const from = db.accounts.find((x) => x.id === input.fromReserveId);
  const to = db.accounts.find((x) => x.id === input.toReserveId);
  if (!from || !to) return { ok: false, error: "Reserve not found." };
  if (from.balance + 1e-9 < amt) return { ok: false, error: "Source reserve balance is insufficient." };
  const actor = input.actorLabel.trim() || "User";
  const ts = new Date().toISOString();
  from.balance = roundMoney(from.balance - amt);
  to.balance = roundMoney(to.balance + amt);
  from.updatedAt = ts;
  to.updatedAt = ts;
  from.lastWithdrawalAt = ts;
  to.lastDepositAt = ts;
  from.lastChangedByLabel = actor;
  to.lastChangedByLabel = actor;
  setAccountsDb(db);
  appendMovement({
    reserveId: from.id,
    kind: "transfer_out",
    amount: -amt,
    balanceAfter: from.balance,
    memo: input.memo.trim() || `Transfer to ${to.name}`,
    actorLabel: actor,
    peerReserveId: to.id,
  });
  appendMovement({
    reserveId: to.id,
    kind: "transfer_in",
    amount: amt,
    balanceAfter: to.balance,
    memo: input.memo.trim() || `Transfer from ${from.name}`,
    actorLabel: actor,
    peerReserveId: from.id,
  });
  appendBehaviorSignal("reserve_transfer", `Transferred ${amt.toFixed(2)}: ${from.name} → ${to.name}`, from.id, "info");
  notifyReservesUpdated();
  return { ok: true };
}

export const RESERVE_APPROVAL_QUEUE_UPDATED = "seigen-reserve-approval-queue-updated";

function notifyQueue() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(RESERVE_APPROVAL_QUEUE_UPDATED));
  notifyReservesUpdated();
}

export function listPendingReserveApprovals(): ReserveApprovalRequest[] {
  return getQueueDb()
    .requests.filter((r) => r.status === "pending")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function listReserveApprovalRequests(limit = 100): ReserveApprovalRequest[] {
  return getQueueDb()
    .requests.slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export function submitReserveWithdrawalRequest(input: {
  reserveId: string;
  amount: number;
  reason: string;
  requestedByLabel: string;
  destinationKind?: ReserveFundingDestinationKind;
  destinationRef?: string;
  allotmentLineId?: string;
}): { ok: true; request: ReserveApprovalRequest } | { ok: false; error: string } {
  const amt = roundMoney(input.amount);
  if (amt <= 0) return { ok: false, error: "Enter a positive amount." };
  const a = getReserveAccount(input.reserveId);
  if (!a) return { ok: false, error: "Reserve not found." };
  if (a.balance + 1e-9 < amt) return { ok: false, error: "Amount exceeds reserve balance." };
  const req: ReserveApprovalRequest = {
    id: uid("rqa"),
    status: "pending",
    kind: "withdrawal",
    reserveId: a.id,
    reserveName: a.name,
    branchId: a.branchId,
    amount: amt,
    reason: input.reason.trim() || "Withdrawal request",
    requestedByLabel: input.requestedByLabel.trim() || "User",
    createdAt: new Date().toISOString(),
  };
  const db = getQueueDb();
  db.requests.push(req);
  setQueueDb(db);
  appendBehaviorSignal("reserve_withdrawal_requested", `Withdrawal requested: ${a.name} ${amt.toFixed(2)}`, a.id, "warning");
  notifyQueue();
  return { ok: true, request: req };
}

export function submitReserveReleaseRequest(input: {
  reserveId: string;
  amount: number;
  reason: string;
  requestedByLabel: string;
}): { ok: true; request: ReserveApprovalRequest } | { ok: false; error: string } {
  const amt = roundMoney(input.amount);
  if (amt <= 0) return { ok: false, error: "Enter a positive amount." };
  const a = getReserveAccount(input.reserveId);
  if (!a) return { ok: false, error: "Reserve not found." };
  if (a.balance + 1e-9 < amt) return { ok: false, error: "Amount exceeds reserve balance." };
  const req: ReserveApprovalRequest = {
    id: uid("rqa"),
    status: "pending",
    kind: "release_to_free_cash",
    reserveId: a.id,
    reserveName: a.name,
    branchId: a.branchId,
    amount: amt,
    reason: input.reason.trim() || "Release to free cash",
    requestedByLabel: input.requestedByLabel.trim() || "User",
    createdAt: new Date().toISOString(),
  };
  const db = getQueueDb();
  db.requests.push(req);
  setQueueDb(db);
  appendBehaviorSignal("reserve_release_requested", `Release requested: ${a.name} ${amt.toFixed(2)}`, a.id, "warning");
  notifyQueue();
  return { ok: true, request: req };
}

export function submitReserveMetadataEditRequest(input: {
  reserveId: string;
  newTargetAmount: number | null;
  newDueDate: string | null;
  newPurpose: string;
  reason: string;
  requestedByLabel: string;
}): { ok: true; request: ReserveApprovalRequest } | { ok: false; error: string } {
  const a = getReserveAccount(input.reserveId);
  if (!a) return { ok: false, error: "Reserve not found." };
  const req: ReserveApprovalRequest = {
    id: uid("rqa"),
    status: "pending",
    kind: "metadata_edit",
    reserveId: a.id,
    reserveName: a.name,
    branchId: a.branchId,
    newTargetAmount: input.newTargetAmount,
    newDueDate: input.newDueDate?.trim() ? input.newDueDate.trim().slice(0, 10) : null,
    newPurpose: input.newPurpose.trim(),
    reason: input.reason.trim() || "Metadata change",
    requestedByLabel: input.requestedByLabel.trim() || "User",
    createdAt: new Date().toISOString(),
  };
  const db = getQueueDb();
  db.requests.push(req);
  setQueueDb(db);
  notifyQueue();
  return { ok: true, request: req };
}

function applyWithdrawalOrRelease(req: ReserveApprovalRequest, kind: "withdrawal" | "release_to_free_cash"): boolean {
  const amt = req.amount ?? 0;
  if (amt <= 0) return false;
  const db = getAccountsDb();
  const a = db.accounts.find((x) => x.id === req.reserveId);
  if (!a || a.balance + 1e-9 < amt) return false;
  const ts = new Date().toISOString();

  // Accounting: move from reserve control back to cashbook (default) for withdrawals/releases.
  const memo = req.reason?.trim() || (kind === "release_to_free_cash" ? "Release from reserve" : "Reserve withdrawal");
  const jr = appendBalancedJournalWithLedgers({
    memo: `${memo} · ${a.name}`,
    source: "journal",
    lines: [
      { accountCode: COA_CASH_CODE, accountName: "Cashbook", debit: amt, credit: 0 },
      { accountCode: COA_RESERVE_CONTROL_CODE, accountName: "Reserve control", debit: 0, credit: amt },
    ],
    cashCode: COA_CASH_CODE,
    bankCode: COA_BANK_CODE,
    preparedBy: "Approver",
  });
  if (!jr.ok) return false;

  a.balance = roundMoney(a.balance - amt);
  a.updatedAt = ts;
  a.lastWithdrawalAt = ts;
  a.lastChangedByLabel = "Approver";
  if (a.balance <= 1e-9 && a.status === "in_use") a.status = "completed";
  setAccountsDb(db);
  appendMovement({
    reserveId: a.id,
    kind: kind === "release_to_free_cash" ? "release_to_free_cash" : "withdrawal",
    amount: -amt,
    balanceAfter: a.balance,
    memo,
    actorLabel: req.requestedByLabel,
    approvalRequestId: req.id,
    destinationKind: kind === "release_to_free_cash" ? "manual" : "manual",
    journalBatchId: jr.batch.id,
  });
  appendBehaviorSignal(
    kind === "release_to_free_cash" ? "reserve_released" : "reserve_withdrawn",
    `${kind === "release_to_free_cash" ? "Released" : "Withdrawn"} from ${a.name}: ${amt.toFixed(2)}`,
    a.id,
    "info",
  );
  return true;
}

function applyMetadataEdit(req: ReserveApprovalRequest): boolean {
  const db = getAccountsDb();
  const a = db.accounts.find((x) => x.id === req.reserveId);
  if (!a) return false;
  if (req.newPurpose != null) a.purpose = req.newPurpose.trim() || a.purpose;
  if (req.newTargetAmount !== undefined) {
    a.targetAmount =
      req.newTargetAmount != null && req.newTargetAmount > 0 ? roundMoney(req.newTargetAmount) : null;
  }
  if (req.newDueDate !== undefined) a.dueDate = req.newDueDate;
  a.updatedAt = new Date().toISOString();
  a.lastChangedByLabel = req.requestedByLabel;
  setAccountsDb(db);
  return true;
}

export function approveReserveRequest(id: string): { ok: true } | { ok: false; error: string } {
  const db = getQueueDb();
  const r = db.requests.find((x) => x.id === id);
  if (!r) return { ok: false, error: "Request not found." };
  if (r.status !== "pending") return { ok: false, error: "Request is not pending." };
  if (r.kind === "withdrawal" || r.kind === "release_to_free_cash") {
    if (!applyWithdrawalOrRelease(r, r.kind)) return { ok: false, error: "Could not apply movement (check balance)." };
  } else if (r.kind === "metadata_edit") {
    applyMetadataEdit(r);
  } else if (r.kind === "transfer_out") {
    return { ok: false, error: "Transfer-out approvals use paired reserves — not implemented in this queue item." };
  }
  r.status = "approved";
  r.resolvedAt = new Date().toISOString();
  setQueueDb(db);
  notifyQueue();
  return { ok: true };
}

export function rejectReserveRequest(id: string): { ok: true } | { ok: false; error: string } {
  const db = getQueueDb();
  const r = db.requests.find((x) => x.id === id);
  if (!r) return { ok: false, error: "Request not found." };
  if (r.status !== "pending") return { ok: false, error: "Request is not pending." };
  r.status = "rejected";
  r.resolvedAt = new Date().toISOString();
  setQueueDb(db);
  notifyQueue();
  return { ok: true };
}
