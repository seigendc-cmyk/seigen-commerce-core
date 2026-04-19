export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type JsonCodecOptions = {
  namespace: string;
  version: 1;
};

function keyOf(opts: JsonCodecOptions, key: string) {
  return `${opts.namespace}:v${opts.version}:${key}`;
}

export function createJsonStorage(storage: StorageLike, opts: JsonCodecOptions) {
  return {
    read<T>(key: string, fallback: T): T {
      try {
        const raw = storage.getItem(keyOf(opts, key));
        if (!raw) return fallback;
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    },
    write<T>(key: string, value: T): void {
      storage.setItem(keyOf(opts, key), JSON.stringify(value));
    },
    remove(key: string): void {
      storage.removeItem(keyOf(opts, key));
    },
    fullKey(key: string): string {
      return keyOf(opts, key);
    },
  };
}

export function browserLocalJson(opts: JsonCodecOptions) {
  if (typeof window === "undefined") return null;
  return createJsonStorage(window.localStorage, opts);
}
