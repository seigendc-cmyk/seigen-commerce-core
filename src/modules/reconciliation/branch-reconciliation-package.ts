import type { Id } from "@/modules/inventory/types/models";
import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";
import type { StockRecord } from "@/modules/inventory/types/models";
import { listProductReadModels } from "@/modules/inventory/services/product-read-model";
import { listSales } from "@/modules/pos/services/sales-service";
import { listTerminalProfiles, listTerminalShifts } from "@/modules/terminal/services/terminal-local-store";
import { listLocalListingLinksForBranch } from "@/modules/market-space/services/local-listing-link-store";
import { readMoneyContextSnapshot, type MoneyContextSnapshot } from "@/modules/financial/services/money-context";
import { readOrCreateReconDeviceId } from "./device-id";

export type ReconSchemaVersion = 1;

export type ReconProductMasterRow = {
  skuKey: string;
  canonicalProductId: string;
  sku: string;
  name: string;
  unit: string;
  brand: string | null;
  sellingPrice: number;
  active: boolean;
  forSale: boolean;
  taxable: boolean;
  updatedAt: string;
  mergedProductIds: string[];
};

export type ReconStockRow = {
  productId: string;
  skuKey: string;
  onHandQty: number;
  updatedAt: string;
};

export type ReconSaleRow = {
  id: string;
  receiptNumber: string;
  createdAt: string;
  status: string;
  amountDue: number;
  subtotal: number;
  salesTaxAmount: number | null;
  terminalProfileId: string | null;
  surface: string | null;
};

export type ReconTerminalProfileSummary = {
  id: string;
  terminalCode: string;
  branchId: string;
  isActive: boolean;
  portalType: string;
  operatorLabel: string;
  updatedAt: string;
};

export type ReconShiftSummary = {
  id: string;
  terminalProfileId: string;
  branchId: string;
  status: string;
  openedAt: string;
  closedAt: string | null;
  closingCount: number | null;
};

export type ReconStorefrontPublishState = {
  productId: string;
  listingId: string;
  updatedAt: string;
};

export type BranchReconciliationPackageV1 = {
  schema: "seigen_branch_reconciliation_package";
  schemaVersion: ReconSchemaVersion;
  tenantId: string;
  branchId: string;
  deviceId: string;
  generatedAt: string;
  money: MoneyContextSnapshot;
  productMaster: ReconProductMasterRow[];
  stock: ReconStockRow[];
  sales: ReconSaleRow[];
  terminals: ReconTerminalProfileSummary[];
  shifts: ReconShiftSummary[];
  storefrontPublishState: ReconStorefrontPublishState[];
};

function skuKey(sku: string): string {
  return sku.trim().toLowerCase();
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function roundQty(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function productMasterSnapshot(branchId: Id): ReconProductMasterRow[] {
  // Use ProductReadModel to dedupe by SKU, but enrich with canonical Product.updatedAt.
  const rms = listProductReadModels(branchId);
  const all = InventoryRepo.listProducts();
  const bySku = new Map<string, typeof all>();
  for (const p of all) {
    const k = skuKey(p.sku);
    const key = k.length > 0 ? k : p.id;
    const arr = bySku.get(key) ?? [];
    arr.push(p);
    bySku.set(key, arr);
  }

  const out: ReconProductMasterRow[] = [];
  for (const rm of rms) {
    const k = skuKey(rm.sku) || rm.id;
    const group = bySku.get(k) ?? [];
    const canonical = group.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    out.push({
      skuKey: k,
      canonicalProductId: canonical?.id ?? rm.id,
      sku: rm.sku,
      name: rm.name,
      unit: rm.unit,
      brand: rm.brand?.trim() ? rm.brand.trim() : null,
      sellingPrice: roundMoney(rm.sellingPrice),
      active: rm.active,
      forSale: rm.forSale !== false,
      taxable: rm.taxable !== false,
      updatedAt: canonical?.updatedAt ?? new Date(0).toISOString(),
      mergedProductIds: group.map((p) => p.id).sort(),
    });
  }

  return out.sort((a, b) => a.skuKey.localeCompare(b.skuKey));
}

function stockSnapshot(branchId: Id): ReconStockRow[] {
  const stock = InventoryRepo.listStockByBranch(branchId);
  // Join to SKU keys to make review easier.
  const products = InventoryRepo.listProducts();
  const skuById = new Map(products.map((p) => [p.id, skuKey(p.sku) || p.id]));
  return stock
    .map((s: StockRecord) => ({
      productId: s.productId,
      skuKey: skuById.get(s.productId) ?? s.productId,
      onHandQty: roundQty(s.onHandQty),
      updatedAt: s.updatedAt,
    }))
    .sort((a, b) => a.productId.localeCompare(b.productId));
}

function salesSnapshot(branchId: Id): ReconSaleRow[] {
  return listSales()
    .filter((s) => s.branchId === branchId)
    .map((s) => ({
      id: s.id,
      receiptNumber: s.receiptNumber,
      createdAt: s.createdAt,
      status: s.status,
      amountDue: roundMoney(s.amountDue),
      subtotal: roundMoney(s.subtotal),
      salesTaxAmount: s.salesTaxAmount != null ? roundMoney(s.salesTaxAmount) : null,
      terminalProfileId: s.terminalProfileId ?? null,
      surface: s.surface ?? null,
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function terminalAndShiftSnapshots(branchId: Id): { terminals: ReconTerminalProfileSummary[]; shifts: ReconShiftSummary[] } {
  const terminals = listTerminalProfiles()
    .filter((p) => String(p.branchId) === String(branchId))
    .map((p) => ({
      id: p.id,
      terminalCode: p.terminalCode,
      branchId: String(p.branchId),
      isActive: p.isActive,
      portalType: p.portalType,
      operatorLabel: p.operatorLabel,
      updatedAt: p.updatedAt,
    }))
    .sort((a, b) => a.terminalCode.localeCompare(b.terminalCode));

  const ids = new Set(terminals.map((t) => t.id));
  const shifts = listTerminalShifts()
    .filter((s) => ids.has(s.terminalProfileId) && String(s.branchId) === String(branchId))
    .map((s) => ({
      id: s.id,
      terminalProfileId: s.terminalProfileId,
      branchId: String(s.branchId),
      status: s.status,
      openedAt: s.openedAt,
      closedAt: s.closedAt ?? null,
      closingCount: s.closingCount ?? null,
    }))
    .sort((a, b) => a.openedAt.localeCompare(b.openedAt));

  return { terminals, shifts };
}

function storefrontPublishStateSnapshot(branchId: Id): ReconStorefrontPublishState[] {
  return listLocalListingLinksForBranch(String(branchId));
}

export function buildBranchReconciliationPackageV1(input: { tenantId: string; branchId: Id }): BranchReconciliationPackageV1 {
  const deviceId = readOrCreateReconDeviceId();
  const generatedAt = new Date().toISOString();
  const money = readMoneyContextSnapshot();
  const pm = productMasterSnapshot(input.branchId);
  const st = stockSnapshot(input.branchId);
  const sl = salesSnapshot(input.branchId);
  const { terminals, shifts } = terminalAndShiftSnapshots(input.branchId);
  const pub = storefrontPublishStateSnapshot(input.branchId);

  return {
    schema: "seigen_branch_reconciliation_package",
    schemaVersion: 1,
    tenantId: input.tenantId,
    branchId: String(input.branchId),
    deviceId,
    generatedAt,
    money,
    productMaster: pm,
    stock: st,
    sales: sl,
    terminals,
    shifts,
    storefrontPublishState: pub,
  };
}

export function downloadBranchReconciliationPackageJson(filename: string, pkg: BranchReconciliationPackageV1): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const LAST_EXPORT_KEY_PREFIX = "recon_last_export_v1:";

export function readReconLastExportedAt(branchId: Id): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(`${LAST_EXPORT_KEY_PREFIX}${String(branchId)}`);
  } catch {
    return null;
  }
}

export function writeReconLastExportedAt(branchId: Id, iso: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${LAST_EXPORT_KEY_PREFIX}${String(branchId)}`, iso);
  } catch {
    // ignore
  }
}

