import { browserLocalJson } from "@/modules/inventory/services/storage";
import type { PurchaseOrder } from "@/modules/inventory/types/models";
import { dispatchFinancialLedgersUpdated } from "./financial-events";

const NS = { namespace: "seigen.financial", version: 1 as const };

export type CreditorEntryKind = "invoice" | "payment";

export type CreditorLedgerEntry = {
  id: string;
  createdAt: string;
  invoiceDate: string;
  dueDate: string;
  supplierId: string;
  supplierName: string;
  purchaseOrderId: string;
  poReference: string;
  /** Invoice: positive increases AP. Payment: negative reduces AP. */
  amount: number;
  entryKind?: CreditorEntryKind;
  paymentBatchId?: string;
};

type Db = { entries: CreditorLedgerEntry[] };

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function uid(): string {
  return `cred_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function getDb(): Db {
  const store = browserLocalJson(NS);
  if (!store) return { entries: [] };
  return store.read<Db>("creditors_ap", { entries: [] });
}

function setDb(db: Db) {
  const store = browserLocalJson(NS);
  if (!store) return;
  store.write("creditors_ap", db);
}

export function creditorsLedgerStorageKey(): string {
  const store = browserLocalJson(NS);
  return store?.fullKey("creditors_ap") ?? "seigen.financial:v1:creditors_ap";
}

function normalizeEntry(
  raw: Partial<CreditorLedgerEntry> &
    Pick<CreditorLedgerEntry, "id" | "createdAt" | "supplierId" | "supplierName" | "purchaseOrderId" | "poReference" | "amount">,
): CreditorLedgerEntry {
  const invoiceDate = raw.invoiceDate ?? raw.createdAt;
  let dueDate = raw.dueDate;
  if (!dueDate) {
    const d = new Date(invoiceDate);
    d.setDate(d.getDate() + 30);
    dueDate = d.toISOString();
  }
  const entryKind: CreditorEntryKind =
    raw.entryKind ?? (raw.amount < 0 ? "payment" : "invoice");
  return {
    id: raw.id,
    createdAt: raw.createdAt,
    invoiceDate,
    dueDate,
    supplierId: raw.supplierId,
    supplierName: raw.supplierName,
    purchaseOrderId: raw.purchaseOrderId,
    poReference: raw.poReference,
    amount: raw.amount,
    entryKind,
    paymentBatchId: raw.paymentBatchId,
  };
}

export function listCreditorEntries(limit = 300): CreditorLedgerEntry[] {
  return getDb()
    .entries.map((e) => normalizeEntry(e))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export function listCreditorEntriesForSupplier(supplierId: string): CreditorLedgerEntry[] {
  return getDb()
    .entries.filter((e) => e.supplierId === supplierId)
    .map((e) => normalizeEntry(e))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Sum of entries per supplier (invoices positive, payments negative). */
export function balanceBySupplierId(): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of getDb().entries) {
    const prev = m.get(e.supplierId) ?? 0;
    m.set(e.supplierId, roundMoney(prev + e.amount));
  }
  return m;
}

export function totalCreditorsPayables(): number {
  let s = 0;
  for (const v of balanceBySupplierId().values()) {
    if (v > 0) s += v;
  }
  return roundMoney(s);
}

export type OutstandingCreditorRow = {
  supplierId: string;
  supplierName: string;
  balance: number;
};

export function listOutstandingCreditors(): OutstandingCreditorRow[] {
  const rows: OutstandingCreditorRow[] = [];
  for (const [supplierId, balance] of balanceBySupplierId()) {
    if (balance <= 0) continue;
    const entries = getDb().entries.filter((e) => e.supplierId === supplierId);
    const lastName =
      entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.supplierName ?? supplierId;
    rows.push({ supplierId, supplierName: lastName, balance });
  }
  return rows.sort((a, b) => b.balance - a.balance);
}

/**
 * Payment from COGS: negative AP line. Caller must also post COGS outflow.
 */
export function recordCreditorPaymentEntry(input: {
  supplierId: string;
  supplierName: string;
  amount: number;
  paymentBatchId: string;
  /** Shown in the creditor postings table (e.g. check #, memo). */
  referenceHint?: string;
}): void {
  const a = roundMoney(input.amount);
  if (a <= 0) return;
  const db = getDb();
  const createdAt = new Date().toISOString();
  const id = uid();
  const ref =
    input.referenceHint?.trim() ||
    `Payment · batch ${input.paymentBatchId.slice(-8)}`;
  db.entries.push({
    id,
    createdAt,
    invoiceDate: createdAt,
    dueDate: createdAt,
    supplierId: input.supplierId,
    supplierName: input.supplierName.trim() || "Supplier",
    purchaseOrderId: `pay_${input.paymentBatchId}_${input.supplierId.slice(-6)}`,
    poReference: ref,
    amount: -a,
    entryKind: "payment",
    paymentBatchId: input.paymentBatchId,
  });
  setDb(db);
  dispatchFinancialLedgersUpdated();
}

/**
 * Credit purchase: increases amount owed to supplier. Idempotent per PO id.
 */
export function recordCreditorCreditPurchase(
  po: PurchaseOrder,
  supplierName: string,
  amount: number,
  opts?: { paymentTermsDays?: number },
): void {
  const a = roundMoney(amount);
  if (a <= 0) return;
  const db = getDb();
  if (db.entries.some((e) => e.purchaseOrderId === po.id && e.amount > 0)) return;
  const createdAt = new Date().toISOString();
  const invoiceDate = createdAt;
  const net = opts?.paymentTermsDays;
  const days = typeof net === "number" && net >= 0 ? Math.floor(net) : 30;
  const due = new Date(invoiceDate);
  due.setDate(due.getDate() + days);
  db.entries.push({
    id: uid(),
    createdAt,
    invoiceDate,
    dueDate: due.toISOString(),
    supplierId: po.supplierId,
    supplierName: supplierName.trim() || "Supplier",
    purchaseOrderId: po.id,
    poReference: po.reference?.trim() ? po.reference.trim() : po.id,
    amount: a,
    entryKind: "invoice",
  });
  setDb(db);
  dispatchFinancialLedgersUpdated();
}
