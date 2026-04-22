import { browserLocalJson } from "@/modules/inventory/services/storage";

const NS = { namespace: "seigen.pos", version: 1 as const };

export type IdeliverLedgerEntry = {
  id: string;
  createdAt: string;
  providerId: string;
  providerName: string;
  saleId: string;
  receiptNumber: string;
  /** Credit to provider for delivery portion (payable / clearing). */
  deliveryFee: string;
  note: string;
};

type LedgerDb = { entries: IdeliverLedgerEntry[] };

function uid(): string {
  return `idl_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function getDb(): LedgerDb {
  const store = browserLocalJson(NS);
  if (!store) return { entries: [] };
  return store.read<LedgerDb>("ideliver_ledger", { entries: [] });
}

function setDb(db: LedgerDb) {
  const store = browserLocalJson(NS);
  if (!store) return;
  store.write("ideliver_ledger", db);
}

export function ideliverLedgerStorageKey(): string {
  const store = browserLocalJson(NS);
  return store?.fullKey("ideliver_ledger") ?? "seigen.pos:v1:ideliver_ledger";
}

export function listIdeliverLedgerEntries(limit = 100): IdeliverLedgerEntry[] {
  return getDb()
    .entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

/**
 * Records a credit line for the external provider when a sale includes iDeliver fee.
 * Double-entry settlement to a liability / payable COA is applied when the GL engine is connected.
 */
export function recordIdeliverDeliveryCredit(input: {
  providerId: string;
  providerName: string;
  saleId: string;
  receiptNumber: string;
  deliveryFee: number;
}): void {
  if (input.deliveryFee <= 0) return;
  const db = getDb();
  // Best-effort idempotency per sale id (avoid duplicates on retries).
  if (db.entries.some((e) => e.saleId === input.saleId && e.providerId === input.providerId)) return;
  db.entries.push({
    id: uid(),
    createdAt: new Date().toISOString(),
    providerId: input.providerId,
    providerName: input.providerName,
    saleId: input.saleId,
    receiptNumber: input.receiptNumber,
    deliveryFee: input.deliveryFee.toFixed(2),
    note: "Delivery fee accrual — reconcile in iDeliver / AP when banking is wired.",
  });
  setDb(db);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("seigen-ideliver-ledger-updated"));
  }
}

export function removeIdeliverCreditsForSale(saleId: string): void {
  const db = getDb();
  const next = db.entries.filter((e) => e.saleId !== saleId);
  if (next.length === db.entries.length) return;
  setDb({ entries: next });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("seigen-ideliver-ledger-updated"));
  }
}
