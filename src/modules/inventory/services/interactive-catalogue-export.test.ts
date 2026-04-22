import { beforeEach, describe, expect, it } from "vitest";
import { __dangerousResetInventoryDbForDemoOnly, InventoryRepo } from "./inventory-repo";
import { buildInteractiveCataloguePackageHtml } from "./interactive-catalogue-export";

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

describe("interactive catalogue export package", () => {
  beforeEach(() => {
    installLocalStorageMock();
    __dangerousResetInventoryDbForDemoOnly();
  });

  it("embeds package schema + products derived from ProductReadModel", () => {
    const branch = InventoryRepo.getDefaultTradingBranch() ?? InventoryRepo.getDefaultBranch();
    const p = InventoryRepo.addProduct({
      sku: "SKU-X",
      name: "Test item",
      sectorId: "general" as any,
      unit: "ea",
      sellingPrice: 10,
      costPrice: 5,
      active: true,
      forSale: true,
    } as any);
    InventoryRepo.incrementStock(branch.id, p.id, 1);

    const html = buildInteractiveCataloguePackageHtml({ branchId: branch.id, includeZeroStock: true });
    expect(html).toContain("seigen_offline_catalogue_package_v1");
    expect(html).toContain("seigenPackageData");
    expect(html).toContain("Test item");
    expect(html).toContain("SKU-X");
  });
});

