import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";
import { emptyShopBranch, type ShopBranch } from "@/modules/dashboard/settings/branches/branch-types";
import { readVendorCore, writeVendorCore } from "@/modules/dashboard/settings/vendor-core-storage";

/**
 * Ensures every Inventory branch is represented in Vendor Settings > Branches.
 * This keeps consignment stalls (created as branches) visible in the vendor ecosystem
 * without changing existing InventoryRepo logic.
 */
export function mergeInventoryBranchesIntoVendorBranches(): ShopBranch[] {
  const stored = readVendorCore<ShopBranch[]>("branches", []);
  const byId = new Map<string, ShopBranch>(stored.map((b) => [b.id, b]));
  const inv = InventoryRepo.listBranches();
  let changed = false;

  for (const br of inv) {
    if (byId.has(br.id)) continue;
    const row = emptyShopBranch(br.id);
    row.shopName = br.name ?? "";
    byId.set(br.id, row);
    changed = true;
  }

  const next = Array.from(byId.values());
  if (changed) writeVendorCore("branches", next);
  return next;
}

export function ensureVendorBranchForInventoryBranch(input: { id: string; name: string }): ShopBranch {
  const branches = readVendorCore<ShopBranch[]>("branches", []);
  const existing = branches.find((b) => b.id === input.id);
  if (existing) return existing;
  const row = emptyShopBranch(input.id);
  row.shopName = input.name ?? "";
  const next = [...branches, row];
  writeVendorCore("branches", next);
  return row;
}

