import { beforeEach, describe, expect, it } from "vitest";
import { __dangerousResetInventoryDbForDemoOnly, InventoryRepo } from "@/modules/inventory/services/inventory-repo";
import { buildBranchReconciliationPackageV1 } from "./branch-reconciliation-package";
import { diffBranchReconciliationPackages } from "./branch-reconciliation-diff";

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

describe("reconciliation slices R1+R2", () => {
  beforeEach(() => {
    installLocalStorageMock();
    __dangerousResetInventoryDbForDemoOnly();
  });

  it("builds a branch-scoped package with required fields", () => {
    const branch = InventoryRepo.getDefaultTradingBranch() ?? InventoryRepo.getDefaultBranch();
    const pkg = buildBranchReconciliationPackageV1({ tenantId: "tenant_1", branchId: branch.id });
    expect(pkg.schema).toBe("seigen_branch_reconciliation_package");
    expect(pkg.schemaVersion).toBe(1);
    expect(pkg.tenantId).toBe("tenant_1");
    expect(pkg.branchId).toBe(branch.id);
    expect(pkg.deviceId.length).toBeGreaterThan(5);
    expect(pkg.generatedAt).toMatch(/T/);
    expect(Array.isArray(pkg.productMaster)).toBe(true);
    expect(Array.isArray(pkg.stock)).toBe(true);
    expect(Array.isArray(pkg.sales)).toBe(true);
    expect(Array.isArray(pkg.terminals)).toBe(true);
    expect(Array.isArray(pkg.shifts)).toBe(true);
    expect(Array.isArray(pkg.storefrontPublishState)).toBe(true);
    expect(pkg.money.currencyCode).toMatch(/^[A-Z]{3}$/);
  });

  it("diff is deterministic and flags a stock conflict", () => {
    const branch = InventoryRepo.getDefaultTradingBranch() ?? InventoryRepo.getDefaultBranch();
    const p = InventoryRepo.addProduct({
      sku: "SKU-R",
      name: "Recon item",
      sectorId: "general" as any,
      unit: "ea",
      sellingPrice: 10,
      costPrice: 6,
      active: true,
      forSale: true,
    } as any);
    InventoryRepo.upsertStock(branch.id, p.id, 5);
    const left = buildBranchReconciliationPackageV1({ tenantId: "tenant_1", branchId: branch.id });

    InventoryRepo.upsertStock(branch.id, p.id, 7);
    const right = buildBranchReconciliationPackageV1({ tenantId: "tenant_1", branchId: branch.id });

    const res = diffBranchReconciliationPackages(left, right);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const stockConf = res.report.conflicts.stock.filter((c) => c.productId === p.id && c.kind === "qty_mismatch");
    expect(stockConf.length).toBe(1);
  });
});

