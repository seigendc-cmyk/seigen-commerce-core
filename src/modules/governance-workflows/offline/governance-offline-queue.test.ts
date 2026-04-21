import { describe, expect, it, vi, beforeEach } from "vitest";

// LocalStorage mock
function makeStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

describe("governance offline queue", () => {
  beforeEach(() => {
    (globalThis as any).window = {
      localStorage: makeStorage(),
      dispatchEvent: vi.fn(),
    };
  });

  it("enqueues items", async () => {
    const { enqueueOffline, listOfflineQueue } = await import("./governance-offline-queue");
    enqueueOffline("approval.stage_action", { requestId: "r1" });
    const rows = listOfflineQueue();
    expect(rows.length).toBe(1);
    expect(rows[0].kind).toBe("approval.stage_action");
  });
});

