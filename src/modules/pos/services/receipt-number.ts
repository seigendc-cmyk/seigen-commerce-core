import { browserLocalJson } from "@/modules/inventory/services/storage";

const NS = { namespace: "seigen.pos", version: 1 as const };

type CounterState = {
  /** Local calendar day as YYYYMMDD (device timezone). */
  dayKey: string;
  /** Increments per sale within `dayKey`. */
  seq: number;
};

function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/**
 * Next receipt number: `REC-YYYYMMDD-#####` (5-digit daily sequence, resets each local day).
 * Stored under `seigen.pos:v1:receipt_counter` (logical key `receipt_counter`).
 */
export function nextReceiptNumber(): string {
  const store = browserLocalJson(NS);
  const now = new Date();
  const dayKey = localDayKey(now);
  if (!store) {
    return `REC-${dayKey}-${String(now.getTime()).slice(-5)}`;
  }
  const prev = store.read<CounterState>("receipt_counter", { dayKey: "", seq: 0 });
  const seq = prev.dayKey === dayKey ? prev.seq + 1 : 1;
  store.write("receipt_counter", { dayKey, seq });
  const y = dayKey.slice(0, 4);
  const m = dayKey.slice(4, 6);
  const d = dayKey.slice(6, 8);
  return `REC-${y}${m}${d}-${String(seq).padStart(5, "0")}`;
}

export const receiptCounterStorageKey = (() => {
  const store = browserLocalJson(NS);
  return store?.fullKey("receipt_counter") ?? `${NS.namespace}:v${NS.version}:receipt_counter`;
})();
