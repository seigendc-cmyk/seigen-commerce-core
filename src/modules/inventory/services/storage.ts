export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type JsonCodecOptions = {
  namespace: string;
  version: 1;
};

let browserTenantScope: string | null = null;

/**
 * Optional tenant scope for local-first operational truth on shared devices.
 * When set, `browserLocalJson()` will prefer scoped keys and fall back to legacy keys for reads.
 */
export function setBrowserLocalTenantScope(tenantId: string | null | undefined): void {
  const next = typeof tenantId === "string" ? tenantId.trim() : "";
  browserTenantScope = next ? next : null;
}

function keyOf(opts: JsonCodecOptions, key: string) {
  return `${opts.namespace}:v${opts.version}:${key}`;
}

function scopedKeyOf(opts: JsonCodecOptions, scope: string, key: string) {
  return `${opts.namespace}:v${opts.version}:${scope}:${key}`;
}

export function createJsonStorage(storage: StorageLike, opts: JsonCodecOptions, scope?: string | null) {
  const s = typeof scope === "string" && scope.trim() ? scope.trim() : null;
  const k = (key: string) => (s ? scopedKeyOf(opts, s, key) : keyOf(opts, key));
  const legacyK = (key: string) => keyOf(opts, key);
  return {
    read<T>(key: string, fallback: T): T {
      try {
        // Tenant-scoped truth: prefer scoped key, but always fall back to legacy reads.
        const raw = storage.getItem(k(key)) ?? (s ? storage.getItem(legacyK(key)) : null);
        if (!raw) return fallback;
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    },
    write<T>(key: string, value: T): void {
      storage.setItem(k(key), JSON.stringify(value));
    },
    remove(key: string): void {
      // Remove both, so scoped installs can clean up legacy keys safely.
      storage.removeItem(k(key));
      if (s) storage.removeItem(legacyK(key));
    },
    fullKey(key: string): string {
      return k(key);
    },
  };
}

export function browserLocalJson(opts: JsonCodecOptions) {
  if (typeof window === "undefined") return null;
  return createJsonStorage(window.localStorage, opts, browserTenantScope);
}
