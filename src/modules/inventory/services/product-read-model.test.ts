import { beforeEach, describe, expect, it } from "vitest";
import { __dangerousResetInventoryDbForDemoOnly, InventoryRepo, HEAD_OFFICE_BRANCH_ID, inventoryKeys } from "./inventory-repo";
import { listProductReadModels } from "./product-read-model";

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
  // `browserLocalJson()` gates on `typeof window !== "undefined"`.
  (globalThis as any).window = { localStorage, dispatchEvent: () => {} };
}

describe("inventory product read model (local-first truth)", () => {
  beforeEach(() => {
    installLocalStorageMock();
    __dangerousResetInventoryDbForDemoOnly();
  });

  it("dedupes duplicate SKUs by summing on-hand across product IDs", () => {
    const trading = InventoryRepo.addBranch({ name: "Shop A", kind: "trading" });
    InventoryRepo.setDefaultBranch(trading.id);

    const p1 = InventoryRepo.addProduct({
      sku: "SKU-1",
      name: "Widget v1",
      sectorId: "general" as any,
      unit: "ea",
      sellingPrice: 10,
      costPrice: 6,
      active: true,
    } as any);

    // `InventoryRepo.addProduct()` enforces unique SKU; duplicates can exist in legacy installs.
    // Simulate a legacy duplicate by directly inserting a second product row into the local DB.
    const raw = (window as any).localStorage.getItem(inventoryKeys.db());
    expect(raw).toBeTruthy();
    const db = JSON.parse(raw!);
    // Make the originally-added product look older than the legacy duplicate.
    const p1Row = db.products.find((p: any) => p.id === p1.id);
    if (p1Row) {
      p1Row.createdAt = "2026-01-01T00:00:00.000Z";
      p1Row.updatedAt = "2026-01-01T00:00:00.000Z";
    }
    const p2 = {
      ...p1,
      id: "prd_legacy_dup",
      name: "Widget v2",
      sellingPrice: 11,
      costPrice: 7,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-02-01T00:00:00.000Z",
    };
    db.products.push(p2);
    (window as any).localStorage.setItem(inventoryKeys.db(), JSON.stringify(db));

    InventoryRepo.upsertStock(trading.id, p1.id, 3);
    InventoryRepo.upsertStock(trading.id, p2.id, 5);

    const rows = listProductReadModels(trading.id);
    const sku1 = rows.find((r) => r.sku === "SKU-1");
    expect(sku1).toBeTruthy();
    expect(sku1!.onHandQty).toBe(8);

    // Canonical row is most recently updated product (v2 here).
    expect(sku1!.name).toBe("Widget v2");
    expect(sku1!.sellingPrice).toBe(11);
  });

  it("does not treat head office as a trading branch when resolving default trading branch", () => {
    const ho = InventoryRepo.getHeadOfficeBranch();
    expect(ho.id).toBe(HEAD_OFFICE_BRANCH_ID);

    // Add two trading branches and mark one as default.
    const t1 = InventoryRepo.addBranch({ name: "Shop 1", kind: "trading" });
    const t2 = InventoryRepo.addBranch({ name: "Shop 2", kind: "trading" });
    InventoryRepo.setDefaultBranch(t2.id);

    // Even if active branch is set to head office, default trading branch should resolve to a trading branch.
    InventoryRepo.setActiveBranchId(ho.id);
    const resolved = InventoryRepo.getDefaultTradingBranch();
    expect(resolved).toBeTruthy();
    expect(resolved!.id).toBe(t2.id);
  });
});

