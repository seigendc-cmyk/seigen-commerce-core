import { describe, expect, it } from "vitest";
import { createJsonStorage } from "./storage";

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    keys: () => [...m.keys()],
  };
}

describe("json storage tenant scoping", () => {
  it("writes to scoped keys when scope is set, but reads legacy key as fallback", () => {
    const storage = memoryStorage();
    const opts = { namespace: "seigen.demo", version: 1 as const };

    // Legacy write.
    const legacy = createJsonStorage(storage, opts, null);
    legacy.write("k", { v: 1 });

    // Scoped read prefers scoped (missing) then falls back to legacy.
    const scoped = createJsonStorage(storage, opts, "tenant_1");
    expect(scoped.read("k", { v: 0 })).toEqual({ v: 1 });

    // Scoped write goes to scoped key and does not overwrite legacy.
    scoped.write("k", { v: 2 });
    expect(scoped.read("k", { v: 0 })).toEqual({ v: 2 });
    expect(legacy.read("k", { v: 0 })).toEqual({ v: 1 });

    // Both keys exist.
    expect(storage.keys().sort()).toEqual(
      ["seigen.demo:v1:k", "seigen.demo:v1:tenant_1:k"].sort(),
    );
  });
});

