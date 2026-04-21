import { browserLocalJson } from "@/modules/inventory/services/storage";

const NS = { namespace: "seigen.vendor-core", version: 1 as const };

export function readVendorCore<T>(key: string, fallback: T): T {
  const store = browserLocalJson(NS);
  if (!store) return fallback;
  return store.read<T>(key, fallback);
}

export function writeVendorCore<T>(key: string, value: T) {
  const store = browserLocalJson(NS);
  if (!store) return;
  store.write(key, value);
}

