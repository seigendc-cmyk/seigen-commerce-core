import { beforeEach, describe, expect, it } from "vitest";
import { __dangerousResetInventoryDbForDemoOnly, DEFAULT_WAREHOUSE_BRANCH_ID, InventoryRepo } from "@/modules/inventory/services/inventory-repo";
import { finalizeSale } from "./sales-service";

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

describe("POS branch discipline", () => {
  beforeEach(() => {
    installLocalStorageMock();
    __dangerousResetInventoryDbForDemoOnly();
  });

  it("rejects POS sales on the warehouse branch", () => {
    // Ensure a valid product exists so the cart shape is realistic.
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
      { branchId: DEFAULT_WAREHOUSE_BRANCH_ID, surface: "desktop" },
    );

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.toLowerCase()).toContain("cannot ring pos sales");
    }
  });
});

