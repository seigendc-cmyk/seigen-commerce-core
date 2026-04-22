import { beforeEach, describe, expect, it } from "vitest";
import { __dangerousResetInventoryDbForDemoOnly, InventoryRepo } from "@/modules/inventory/services/inventory-repo";
import {
  buildPublishMarketListingPayloadFromOperationalTruth,
  derivePublishableStockSignal,
} from "./operational-listing-payload-builder";

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

describe("operational listing payload builder", () => {
  beforeEach(() => {
    installLocalStorageMock();
    __dangerousResetInventoryDbForDemoOnly();
  });

  it("derives stock signal from on-hand + reorder", () => {
    expect(
      derivePublishableStockSignal({
        onHandQty: 0,
        reorderQty: 0,
        inventoryType: "inventory",
        active: true,
        forSale: true,
      }).stock_signal,
    ).toBe("out_of_stock");

    expect(
      derivePublishableStockSignal({
        onHandQty: 2,
        reorderQty: 5,
        inventoryType: "inventory",
        active: true,
        forSale: true,
      }).stock_signal,
    ).toBe("low_stock");

    expect(
      derivePublishableStockSignal({
        onHandQty: 6,
        reorderQty: 5,
        inventoryType: "inventory",
        active: true,
        forSale: true,
      }).stock_signal,
    ).toBe("in_stock");
  });

  it("builds a publish payload derived from ProductReadModel truth", () => {
    const branch = InventoryRepo.getDefaultTradingBranch() ?? InventoryRepo.getDefaultBranch();
    expect(branch).toBeTruthy();

    const p = InventoryRepo.addProduct({
      sku: "SKU-42",
      name: "Maize Meal 10kg",
      sectorId: "general" as any,
      unit: "bag",
      sellingPrice: 12.5,
      costPrice: 9,
      active: true,
      forSale: true,
      reorderQty: 3,
    } as any);

    InventoryRepo.incrementStock(branch.id, p.id, 2);

    const res = buildPublishMarketListingPayloadFromOperationalTruth({
      vendor_id: "vendor_1",
      storefront_id: "storefront_1",
      branch_id: branch.id,
      product_id: p.id,
      publish_status: "draft",
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.payload.product_id).toBe(p.id);
    expect(res.payload.branch_id).toBe(branch.id);
    expect(res.payload.title).toContain("Maize");
    expect(res.payload.public_price).toBe(12.5);
    expect(res.payload.stock_signal).toBe("low_stock");
    expect(res.payload.currency_code).toMatch(/^[A-Z]{3}$/);
    expect(res.payload.listing_slug.length).toBeGreaterThan(0);
  });
});

