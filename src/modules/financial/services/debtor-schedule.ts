import { browserLocalJson } from "@/modules/inventory/services/storage";
import { dispatchFinancialLedgersUpdated } from "./financial-events";

const NS = { namespace: "seigen.financial", version: 1 as const };

type Db = {
  nextCollectionByCustomer: Record<string, string>;
};

function getDb(): Db {
  const store = browserLocalJson(NS);
  if (!store) return { nextCollectionByCustomer: {} };
  return store.read<Db>("debtor_schedule", { nextCollectionByCustomer: {} });
}

function setDb(db: Db) {
  const store = browserLocalJson(NS);
  if (!store) return;
  store.write("debtor_schedule", db);
}

export const DEBTOR_SCHEDULE_UPDATED = "seigen-debtor-schedule-updated";

export function getScheduledDebtorCollectionDate(customerId: string): string | undefined {
  const v = getDb().nextCollectionByCustomer[customerId];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export function setScheduledDebtorCollectionDate(customerId: string, isoDate: string): void {
  const db = getDb();
  db.nextCollectionByCustomer[customerId] = isoDate;
  setDb(db);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(DEBTOR_SCHEDULE_UPDATED));
    dispatchFinancialLedgersUpdated();
  }
}

export function clearScheduledDebtorCollectionDate(customerId: string): void {
  const db = getDb();
  delete db.nextCollectionByCustomer[customerId];
  setDb(db);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(DEBTOR_SCHEDULE_UPDATED));
    dispatchFinancialLedgersUpdated();
  }
}
