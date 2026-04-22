import type { Id, Product } from "../types/models";
import { branchAllowsStockOperations, InventoryRepo, isHeadOfficeBranch } from "./inventory-repo";

export type AssemblyResult = { ok: true; message: string } | { ok: false; error: string };

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Landed cost basis for valuation (average cost falls back to unit cost). */
export function landCostPerUnit(product: Product): number {
  const a = product.averageCost;
  const c = product.costPrice;
  const v = typeof a === "number" && Number.isFinite(a) && a >= 0 ? a : c;
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? roundMoney(v) : 0;
}

function isStockSku(p: Product | undefined): boolean {
  if (!p) return false;
  return (p.inventoryType ?? "inventory") === "inventory";
}

/**
 * Build `qty` units of the parent SKU by consuming assembly BOM components at the default branch.
 * Updates parent average cost using a weighted average of existing stock and this build's component cost.
 */
export function executeAssemblyBuild(parentProductId: Id, qtyToBuild: number): AssemblyResult {
  if (!Number.isFinite(qtyToBuild) || qtyToBuild <= 0 || !Number.isInteger(qtyToBuild)) {
    return { ok: false, error: "Build quantity must be a positive whole number." };
  }

  const parent = InventoryRepo.getProduct(parentProductId);
  if (!parent) return { ok: false, error: "Product not found." };
  if (!isStockSku(parent)) {
    return { ok: false, error: "Only stocked inventory SKUs can receive assembly output." };
  }

  const inputs = parent.bom?.assemblyInputs;
  if (!inputs?.length) {
    return { ok: false, error: "Define assembly components on the product BOM before building stock." };
  }

  const branch = InventoryRepo.getDefaultTradingBranch() ?? InventoryRepo.getDefaultWarehouseBranch();
  if (!branch) {
    return {
      ok: false,
      error:
        "No stock branch — assembly moves stock at a trading shop or warehouse. Add a branch under Inventory → Overview.",
    };
  }
  if (isHeadOfficeBranch(branch) || !branchAllowsStockOperations(branch)) {
    return { ok: false, error: "Assembly cannot move stock at Head office. Select a trading shop or warehouse." };
  }

  for (const line of inputs) {
    if (line.productId === parentProductId) {
      return { ok: false, error: "BOM cannot reference the same product as the assembly output." };
    }
    const comp = InventoryRepo.getProduct(line.productId);
    if (!comp) return { ok: false, error: `Component product not found (${line.productId}).` };
    if (!isStockSku(comp)) {
      return { ok: false, error: `Component ${comp.sku} is not a stocked item — cannot consume from inventory.` };
    }
    const need = roundMoney(line.qty * qtyToBuild);
    if (need <= 0) return { ok: false, error: "Each BOM line must use a positive quantity." };
    const onHand = InventoryRepo.getStock(branch.id, line.productId)?.onHandQty ?? 0;
    if (onHand + 1e-9 < need) {
      return {
        ok: false,
        error: `Insufficient ${comp.sku}: need ${need} ${comp.unit}, have ${onHand}.`,
      };
    }
  }

  let totalComponentCost = 0;
  for (const line of inputs) {
    const comp = InventoryRepo.getProduct(line.productId)!;
    const need = roundMoney(line.qty * qtyToBuild);
    const unitCost = landCostPerUnit(comp);
    totalComponentCost = roundMoney(totalComponentCost + need * unitCost);
    InventoryRepo.incrementStock(branch.id, line.productId, -need);
  }

  const parentOnHand = InventoryRepo.getStock(branch.id, parentProductId)?.onHandQty ?? 0;
  const parentLand = landCostPerUnit(parent);
  const newOnHand = parentOnHand + qtyToBuild;
  const newAvg =
    newOnHand > 0
      ? roundMoney((parentLand * parentOnHand + totalComponentCost) / newOnHand)
      : parentLand;

  InventoryRepo.incrementStock(branch.id, parentProductId, qtyToBuild);
  InventoryRepo.updateProduct(parentProductId, {
    averageCost: newAvg,
    costPrice: parent.costPrice,
  });

  return {
    ok: true,
    message: `Built ${qtyToBuild} × ${parent.sku}. Component cost ${totalComponentCost.toFixed(2)} allocated; new average cost ${newAvg.toFixed(2)}.`,
  };
}

/**
 * Break down `qty` units of the parent SKU into BOM outputs (salvage, cores, tanks, purchased parts mix).
 * Parent cost is allocated to outputs by relative standard cost (cost price), with equal fallback.
 */
export function executeDisassembly(parentProductId: Id, qtyToBreak: number): AssemblyResult {
  if (!Number.isFinite(qtyToBreak) || qtyToBreak <= 0 || !Number.isInteger(qtyToBreak)) {
    return { ok: false, error: "Break quantity must be a positive whole number." };
  }

  const parent = InventoryRepo.getProduct(parentProductId);
  if (!parent) return { ok: false, error: "Product not found." };
  if (!isStockSku(parent)) {
    return { ok: false, error: "Only stocked inventory SKUs can be disassembled." };
  }

  const outputs = parent.bom?.disassemblyOutputs;
  if (!outputs?.length) {
    return { ok: false, error: "Define disassembly outputs on the product BOM before breaking stock down." };
  }

  const branch = InventoryRepo.getDefaultTradingBranch() ?? InventoryRepo.getDefaultWarehouseBranch();
  if (!branch) {
    return {
      ok: false,
      error:
        "No stock branch — disassembly moves stock at a trading shop or warehouse. Add a branch under Inventory → Overview.",
    };
  }
  if (isHeadOfficeBranch(branch) || !branchAllowsStockOperations(branch)) {
    return { ok: false, error: "Disassembly cannot move stock at Head office. Select a trading shop or warehouse." };
  }
  const parentOnHand = InventoryRepo.getStock(branch.id, parentProductId)?.onHandQty ?? 0;
  if (parentOnHand + 1e-9 < qtyToBreak) {
    return { ok: false, error: `Insufficient ${parent.sku} on hand: need ${qtyToBreak}, have ${parentOnHand}.` };
  }

  for (const line of outputs) {
    if (line.productId === parentProductId) {
      return { ok: false, error: "BOM cannot output the same product as the item being disassembled." };
    }
    const out = InventoryRepo.getProduct(line.productId);
    if (!out) return { ok: false, error: `Output product not found (${line.productId}).` };
    if (!isStockSku(out)) {
      return { ok: false, error: `Output ${out.sku} must be a stocked SKU to receive inventory.` };
    }
  }

  const parentUnitCost = landCostPerUnit(parent);
  const totalCostToAllocate = roundMoney(parentUnitCost * qtyToBreak);

  const weightPerLine = outputs.map((line) => {
    const p = InventoryRepo.getProduct(line.productId)!;
    const w = Math.max(landCostPerUnit(p), 0.0001) * line.qty;
    return { line, weight: w, addQty: roundMoney(line.qty * qtyToBreak) };
  });
  const sumW = weightPerLine.reduce((s, x) => s + x.weight, 0);

  InventoryRepo.incrementStock(branch.id, parentProductId, -qtyToBreak);

  for (const row of weightPerLine) {
    const { line, weight, addQty } = row;
    if (addQty <= 0) continue;
    const share = sumW > 0 ? weight / sumW : 1 / weightPerLine.length;
    const allocated = roundMoney(totalCostToAllocate * share);
    const out = InventoryRepo.getProduct(line.productId)!;
    const prevOn = InventoryRepo.getStock(branch.id, line.productId)?.onHandQty ?? 0;
    const prevLand = landCostPerUnit(out);
    const newOn = prevOn + addQty;
    const newAvg = newOn > 0 ? roundMoney((prevLand * prevOn + allocated) / newOn) : prevLand;

    InventoryRepo.incrementStock(branch.id, line.productId, addQty);
    InventoryRepo.updateProduct(line.productId, { averageCost: newAvg, costPrice: out.costPrice });
  }

  const parentAfter = InventoryRepo.getStock(branch.id, parentProductId)?.onHandQty ?? 0;
  if (parentAfter <= 0) {
    const p2 = InventoryRepo.getProduct(parentProductId);
    if (p2) {
      InventoryRepo.updateProduct(parentProductId, {
        averageCost: landCostPerUnit(p2),
      });
    }
  }

  return {
    ok: true,
    message: `Disassembled ${qtyToBreak} × ${parent.sku}. Cost ${totalCostToAllocate.toFixed(2)} allocated across ${outputs.length} output line(s).`,
  };
}
