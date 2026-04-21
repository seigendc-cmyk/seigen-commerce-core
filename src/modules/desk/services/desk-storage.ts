import { browserLocalJson } from "@/modules/inventory/services/storage";

export const DESK_NS = { namespace: "seigen.desk", version: 1 as const };

export function readDeskDb<T>(key: string, fallback: T): T {
  const store = browserLocalJson(DESK_NS);
  if (!store) return fallback;
  return store.read<T>(key, fallback);
}

export function writeDeskDb<T>(key: string, value: T) {
  const store = browserLocalJson(DESK_NS);
  if (!store) return;
  store.write(key, value);
}

export function deskStorageKey(key: string): string {
  const store = browserLocalJson(DESK_NS);
  return store?.fullKey(key) ?? `${DESK_NS.namespace}:v${DESK_NS.version}:${key}`;
}

