import type { Id } from "@/modules/inventory/types/models";
import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";
import type { Cart } from "../types/pos";

/** Available on-hand at branch for cart validation (same source as ProductReadModel). */
export function availableQty(branchId: Id, productId: Id): number {
  return InventoryRepo.getStock(branchId, productId)?.onHandQty ?? 0;
}

/**
 * Returns a user-facing error if any line requests more than on-hand, else null.
 */
export function validateStockForCart(cart: Cart, branchId: Id): string | null {
  for (const it of cart.items) {
    const onHand = availableQty(branchId, it.productId);
    if (it.qty > onHand) {
      return `Insufficient stock for ${it.name} (${it.sku}): need ${it.qty}, have ${onHand}.`;
    }
  }
  return null;
}
