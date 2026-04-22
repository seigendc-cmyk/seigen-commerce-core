"use client";

import type { Id } from "../types/models";
import {
  branchAllowsStockOperations,
  branchAllowsTradingOperations,
  InventoryRepo,
  isHeadOfficeBranch,
} from "./inventory-repo";

export type StockMutationPolicyResult =
  | { ok: true; branchId: Id }
  | { ok: false; error: string };

export function requireExistingBranch(branchId: Id, err = "Branch not found."): StockMutationPolicyResult {
  const b = InventoryRepo.getBranch(branchId);
  if (!b) return { ok: false, error: err };
  return { ok: true, branchId: b.id };
}

export function requireStockOpsBranch(branchId: Id, err?: string): StockMutationPolicyResult {
  const b = InventoryRepo.getBranch(branchId);
  if (!b) return { ok: false, error: err ?? "Branch not found." };
  if (isHeadOfficeBranch(b) || !branchAllowsStockOperations(b)) {
    return { ok: false, error: err ?? "This location cannot hold or mutate stock. Use a warehouse or trading shop." };
  }
  return { ok: true, branchId: b.id };
}

export function requireTradingBranch(branchId: Id, err?: string): StockMutationPolicyResult {
  const b = InventoryRepo.getBranch(branchId);
  if (!b) return { ok: false, error: err ?? "Branch not found." };
  if (isHeadOfficeBranch(b) || !branchAllowsTradingOperations(b)) {
    return { ok: false, error: err ?? "This location cannot ring sales. Use a trading shop or consignment stall branch." };
  }
  return { ok: true, branchId: b.id };
}

