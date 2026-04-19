import { browserLocalJson } from "@/modules/inventory/services/storage";
import { dispatchFinancialLedgersUpdated } from "./financial-events";

const NS = { namespace: "seigen.financial", version: 1 as const };

type Db = {
  /** Optional next payment due date per supplier (ISO) when user defers or plans payment. */
  nextDueBySupplier: Record<string, string>;
};

function getDb(): Db {
  const store = browserLocalJson(NS);
  if (!store) return { nextDueBySupplier: {} };
  return store.read<Db>("creditor_schedule", { nextDueBySupplier: {} });
}

function setDb(db: Db) {
  const store = browserLocalJson(NS);
  if (!store) return;
  store.write("creditor_schedule", db);
}

export const CREDITOR_SCHEDULE_UPDATED = "seigen-creditor-schedule-updated";

export function getScheduledNextDueDate(supplierId: string): string | undefined {
  const v = getDb().nextDueBySupplier[supplierId];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export function setScheduledNextDueDate(supplierId: string, isoDate: string): void {
  const db = getDb();
  db.nextDueBySupplier[supplierId] = isoDate;
  setDb(db);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CREDITOR_SCHEDULE_UPDATED));
    dispatchFinancialLedgersUpdated();
  }
}

export function clearScheduledNextDueDate(supplierId: string): void {
  const db = getDb();
  delete db.nextDueBySupplier[supplierId];
  setDb(db);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CREDITOR_SCHEDULE_UPDATED));
    dispatchFinancialLedgersUpdated();
  }
}
