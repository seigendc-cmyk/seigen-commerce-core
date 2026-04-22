import { beforeEach, describe, expect, it } from "vitest";
import type { TerminalProfile } from "../types/terminal-types";
import { __dangerousResetInventoryDbForDemoOnly, InventoryRepo } from "@/modules/inventory/services/inventory-repo";
import { upsertTerminalProfile } from "./terminal-local-store";
import { getPersistedActiveSession, startTerminalSession } from "./terminal-session-service";

function installLocalStorageMock() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => {
      store.clear();
    },
  };
  (globalThis as any).window = { localStorage, dispatchEvent: () => {}, addEventListener: () => {}, removeEventListener: () => {} };
  // Vitest/jsdom may provide a read-only navigator; define a minimal navigator via property definition.
  try {
    Object.defineProperty(globalThis, "navigator", {
      value: { userAgent: "ua", language: "en", onLine: true },
      configurable: true,
    });
  } catch {
    // ignore
  }
}

function mkProfile(branchId: string): TerminalProfile {
  return {
    id: "tprof_1",
    tenantId: "local",
    terminalCode: "TERM-TEST",
    userId: null,
    branchId: branchId as any,
    stallId: null,
    role: "cashier",
    portalType: "cashier",
    isActive: true,
    requiresPin: false,
    pinHash: null,
    permissions: ["terminal.sale.create"],
    operatorLabel: "Cashier",
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("terminal trust hardening", () => {
  beforeEach(() => {
    installLocalStorageMock();
    __dangerousResetInventoryDbForDemoOnly();
  });

  it("invalidates persisted session when profile updatedAt changes", () => {
    const branch = InventoryRepo.getDefaultTradingBranch() ?? InventoryRepo.getDefaultBranch();
    const p1 = mkProfile(branch.id);
    upsertTerminalProfile(p1);
    const sess = startTerminalSession(p1, "code");
    const ok1 = getPersistedActiveSession(p1);
    expect(ok1?.id).toBe(sess.id);

    const p2 = { ...p1, updatedAt: "2026-02-01T00:00:00.000Z" };
    upsertTerminalProfile(p2);
    const ok2 = getPersistedActiveSession(p2);
    expect(ok2).toBe(null);
  });
});

