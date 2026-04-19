import type { Id } from "./models";

/** How the SKU is treated in stock and fulfilment flows. */
export type InventoryItemType = "service" | "inventory" | "non_inventory";

export const INVENTORY_ITEM_TYPE_OPTIONS: { id: InventoryItemType; label: string }[] = [
  { id: "service", label: "Service" },
  { id: "inventory", label: "Inventory" },
  { id: "non_inventory", label: "Non-inventory" },
];

export function labelForInventoryItemType(t: InventoryItemType | undefined): string {
  if (!t) return "Inventory";
  return INVENTORY_ITEM_TYPE_OPTIONS.find((o) => o.id === t)?.label ?? t;
}

/** Per-branch selling price overrides; missing branch = use standard (selling) price. */
export type BranchPriceMap = Partial<Record<Id, number>>;
