import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/financial/services/cogs-reserves-ledger", () => ({
  recordCogsReservesFromSale: () => {
    throw new Error("cogs_post_failed");
  },
}));

import { __dangerousResetInventoryDbForDemoOnly, InventoryRepo } from "@/modules/inventory/services/inventory-repo";
import { listSales, finalizeSale } from "./sales-service";

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
  (globalThis as any).document = { visibilityState: "visible", addEventListener: () => {}, removeEventListener: () => {} };
}

describe("POS finalizeSale local atomicity", () => {
  beforeEach(() => {
    installLocalStorageMock();
    __dangerousResetInventoryDbForDemoOnly();
  });

  it("rolls back stock and sale record when a downstream posting throws", () => {
    const branch = InventoryRepo.addBranch({ name: "Shop", kind: "trading" });
    InventoryRepo.setDefaultBranch(branch.id);

    const p = InventoryRepo.addProduct({
      sku: "SKU-1",
      name: "Widget",
      sectorId: "general" as any,
      unit: "ea",
      sellingPrice: 10,
      costPrice: 6,
      active: true,
      forSale: true,
    } as any);

    InventoryRepo.upsertStock(branch.id, p.id, 2);

    const before = InventoryRepo.getStock(branch.id, p.id)?.onHandQty ?? 0;
    const res = finalizeSale(
      {
        items: [
          {
            productId: p.id,
            sku: p.sku,
            name: p.name,
            unit: p.unit ?? "ea",
            unitPrice: 10,
            qty: 1,
            lineTotal: 10,
            taxable: true,
          },
        ],
        subtotal: 10,
        delivery: { enabled: false, providerId: null, distanceKm: 0, overrideEnabled: false, overrideAmount: 0 },
      },
      { method: "cash", amount: 10 },
      { branchId: branch.id, surface: "desktop" },
    );

    expect(res.ok).toBe(false);
    const after = InventoryRepo.getStock(branch.id, p.id)?.onHandQty ?? 0;
    expect(after).toBe(before);
    expect(listSales().length).toBe(0);
  });
});

