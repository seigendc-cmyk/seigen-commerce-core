import type { Id } from "@/modules/inventory/types/models";
import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";
import { appendDeskAuditEvent } from "@/modules/desk/services/desk-audit";
import type { BranchReconciliationPackageV1, ReconStockRow } from "./branch-reconciliation-package";
import { buildBranchReconciliationPackageV1 } from "./branch-reconciliation-package";
import { diffBranchReconciliationPackages } from "./branch-reconciliation-diff";

export type ReconImportValidation =
  | { ok: true; pkg: BranchReconciliationPackageV1; local: BranchReconciliationPackageV1; diffSummary: { product: number; stock: number; sales: number; terminal: number; shift: number; storefrontPublish: number } }
  | { ok: false; error: string };

export function parseReconPackageJson(raw: string): { ok: true; pkg: BranchReconciliationPackageV1 } | { ok: false; error: string } {
  try {
    const obj = JSON.parse(raw) as BranchReconciliationPackageV1;
    if (!obj || obj.schema !== "seigen_branch_reconciliation_package") return { ok: false, error: "Not a reconciliation package." };
    if (obj.schemaVersion !== 1) return { ok: false, error: "Unsupported package version." };
    if (!obj.tenantId || !obj.branchId) return { ok: false, error: "Invalid package (missing tenant/branch)." };
    return { ok: true, pkg: obj };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid JSON." };
  }
}

export function validateReconImport(input: {
  tenantId: string;
  branchId: Id;
  pkg: BranchReconciliationPackageV1;
}): ReconImportValidation {
  if (input.pkg.tenantId !== input.tenantId) return { ok: false, error: "Tenant mismatch." };
  if (String(input.pkg.branchId) !== String(input.branchId)) return { ok: false, error: "Branch mismatch." };
  const local = buildBranchReconciliationPackageV1({ tenantId: input.tenantId, branchId: input.branchId });
  const diff = diffBranchReconciliationPackages(local, input.pkg);
  if (!diff.ok) return { ok: false, error: diff.error };
  return {
    ok: true,
    pkg: input.pkg,
    local,
    diffSummary: {
      product: diff.report.conflicts.product.length,
      stock: diff.report.conflicts.stock.length,
      sales: diff.report.conflicts.sales.length,
      terminal: diff.report.conflicts.terminal.length,
      shift: diff.report.conflicts.shift.length,
      storefrontPublish: diff.report.conflicts.storefrontPublish.length,
    },
  };
}

export type ApplyReconStockResult =
  | { ok: true; applied: number; skippedMissingProducts: number; auditCorrelationId: string }
  | { ok: false; error: string };

function safeRows(rows: ReconStockRow[]): ReconStockRow[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r) => r && typeof r.productId === "string" && r.productId && Number.isFinite(Number(r.onHandQty)))
    .map((r) => ({
      productId: r.productId,
      skuKey: String(r.skuKey ?? "").trim(),
      onHandQty: Math.round(Number(r.onHandQty) * 1000) / 1000,
      updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : new Date(0).toISOString(),
    }));
}

export function applyReconStockSnapshot(input: {
  pkg: BranchReconciliationPackageV1;
  operatorLabel: string;
}): ApplyReconStockResult {
  const branchId = input.pkg.branchId as any as Id;
  const rows = safeRows(input.pkg.stock);
  if (rows.length === 0) return { ok: false, error: "Package has no stock rows." };

  let applied = 0;
  let skippedMissingProducts = 0;
  for (const r of rows) {
    const product = InventoryRepo.getProduct(r.productId as any);
    if (!product) {
      skippedMissingProducts += 1;
      continue;
    }
    InventoryRepo.upsertStock(branchId, r.productId as any, r.onHandQty);
    applied += 1;
  }

  const correlationId = `recon_import_stock_${String(branchId)}_${Date.now()}`;
  appendDeskAuditEvent({
    sourceKind: "desk",
    sourceId: "reconciliation",
    action: "recon.stock.snapshot.applied",
    actorLabel: input.operatorLabel,
    notes: `Applied stock snapshot from device ${input.pkg.deviceId} @ ${input.pkg.generatedAt}`,
    moduleKey: "reconciliation",
    entityType: "branch",
    entityId: String(branchId),
    beforeState: null,
    afterState: { applied, skippedMissingProducts, deviceId: input.pkg.deviceId, generatedAt: input.pkg.generatedAt },
    correlationId,
  });

  return { ok: true, applied, skippedMissingProducts, auditCorrelationId: correlationId };
}

