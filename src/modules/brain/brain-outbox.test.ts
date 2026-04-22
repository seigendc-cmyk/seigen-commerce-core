import { beforeEach, describe, expect, it, vi } from "vitest";

let calls = 0;
vi.mock("./brain-actions", () => ({
  emitPosSaleCompletedBrainEvent: async () => {
    calls += 1;
    return { ok: true, id: `evt_${calls}` };
  },
  emitPosSaleVoidedBrainEvent: async () => {
    calls += 1;
    return { ok: true, id: `evt_${calls}` };
  },
  emitPosReceiptReprintedBrainEvent: async () => {
    calls += 1;
    return { ok: true, id: `evt_${calls}` };
  },
  emitPosSaleReturnedBrainEvent: async () => {
    calls += 1;
    return { ok: true, id: `evt_${calls}` };
  },
  emitTerminalShiftOpenedBrainEvent: async () => {
    calls += 1;
    return { ok: true, id: `evt_${calls}` };
  },
  emitTerminalShiftClosedBrainEvent: async () => {
    calls += 1;
    return { ok: true, id: `evt_${calls}` };
  },
  emitTerminalCashMovementRecordedBrainEvent: async () => {
    calls += 1;
    return { ok: true, id: `evt_${calls}` };
  },
}));

import { enqueuePosSaleCompletedBrainEvent, flushBrainOutbox } from "./brain-outbox";

function installLocalStorageMock() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => void store.clear(),
  };
  (globalThis as any).window = { localStorage, dispatchEvent: () => {} };
}

describe("brain outbox", () => {
  beforeEach(() => {
    calls = 0;
    installLocalStorageMock();
  });

  it("flushes queued items once when emitter succeeds", async () => {
    enqueuePosSaleCompletedBrainEvent({
      sale: {
        id: "sale_1",
        receiptNumber: "REC-20260422-00001",
        status: "completed",
        createdAt: "2026-04-22T00:00:00.000Z",
        branchId: "br_1" as any,
        surface: "terminal",
        terminalProfileId: "tp_1",
        lines: [],
        subtotal: 0,
        deliveryFee: 0,
        amountDue: 0,
        ideliverProviderId: null,
        ideliverProviderName: null,
        ideliverFareSource: "none",
        payments: [{ method: "cash", amount: 0 }],
        totalPaid: 0,
        changeDue: 0,
      },
      correlationId: "corr_1",
    });

    const r1 = await flushBrainOutbox();
    expect(r1.ok).toBe(true);
    if (r1.ok) expect(r1.flushed).toBe(1);

    const r2 = await flushBrainOutbox();
    expect(r2.ok).toBe(true);
    if (r2.ok) expect(r2.flushed).toBe(0);
    expect(calls).toBe(1);
  });
});

