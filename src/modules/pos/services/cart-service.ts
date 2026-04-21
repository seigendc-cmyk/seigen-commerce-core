import type { ProductReadModel } from "@/modules/inventory/types/product-read-model";
import type { Cart, CartDelivery, CartItem } from "../types/pos";

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function lineTotal(unitPrice: number, qty: number): number {
  return roundMoney(unitPrice * qty);
}

export function defaultCartDelivery(): CartDelivery {
  return {
    enabled: false,
    providerId: null,
    distanceKm: 5,
    overrideEnabled: false,
    overrideAmount: 0,
  };
}

export function emptyCart(): Cart {
  return { items: [], subtotal: 0, delivery: defaultCartDelivery() };
}

function withSubtotal(items: CartItem[], delivery: CartDelivery): Cart {
  const subtotal = roundMoney(items.reduce((s, i) => s + i.lineTotal, 0));
  return { items, subtotal, delivery };
}

export function setCartDelivery(cart: Cart, patch: Partial<CartDelivery>): Cart {
  return withSubtotal(cart.items, { ...cart.delivery, ...patch });
}

function isPosSellable(product: ProductReadModel): boolean {
  if (!product.active) return false;
  if (product.forSale === false) return false;
  return true;
}

/**
 * Add or merge line; uses current ProductReadModel.sellingPrice as unitPrice.
 * Does nothing if product is inactive, not for sale at POS, or has no available quantity.
 */
export function addOrIncrementFromProduct(cart: Cart, product: ProductReadModel, addQty = 1): Cart {
  if (!isPosSellable(product)) return cart;
  const maxQty = Math.max(0, Math.floor(product.onHandQty));
  if (maxQty < 1) return cart;

  const qty = Math.max(1, Math.floor(addQty));
  const unitPrice = roundMoney(Math.max(0, product.sellingPrice));
  const idx = cart.items.findIndex((i) => i.productId === product.id);
  let items: CartItem[];
  if (idx < 0) {
    const add = Math.min(qty, maxQty);
    items = [
      ...cart.items,
      {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        unit: product.unit,
        unitPrice,
        qty: add,
        lineTotal: lineTotal(unitPrice, add),
        taxable: product.taxable !== false,
      },
    ];
  } else {
    const prev = cart.items[idx]!;
    const nextQty = Math.min(prev.qty + qty, maxQty);
    items = cart.items.map((it, i) =>
      i === idx
        ? {
            ...it,
            unitPrice,
            qty: nextQty,
            lineTotal: lineTotal(unitPrice, nextQty),
            taxable: product.taxable !== false,
          }
        : it,
    );
  }
  return withSubtotal(items, cart.delivery);
}

/**
 * @param maxQty - cap quantity to on-hand at branch (e.g. from Inventory). Omit when unknown.
 */
export function setLineQty(cart: Cart, productId: string, qty: number, maxQty?: number): Cart {
  let q = Math.floor(qty);
  if (maxQty !== undefined) q = Math.min(q, Math.max(0, Math.floor(maxQty)));
  if (q <= 0) return removeLine(cart, productId);
  const items = cart.items.map((it) =>
    it.productId === productId ? { ...it, qty: q, lineTotal: lineTotal(it.unitPrice, q), taxable: it.taxable } : it,
  );
  return withSubtotal(items, cart.delivery);
}

export function incrementLine(cart: Cart, productId: string, delta: number, maxQty?: number): Cart {
  const it = cart.items.find((i) => i.productId === productId);
  if (!it) return cart;
  return setLineQty(cart, productId, it.qty + delta, maxQty);
}

export function removeLine(cart: Cart, productId: string): Cart {
  const items = cart.items.filter((i) => i.productId !== productId);
  return withSubtotal(items, cart.delivery);
}

export function overrideLineUnitPrice(cart: Cart, productId: string, unitPrice: number): Cart {
  const p = roundMoney(Math.max(0, unitPrice));
  const items = cart.items.map((it) =>
    it.productId === productId ? { ...it, unitPrice: p, lineTotal: lineTotal(p, it.qty) } : it,
  );
  return withSubtotal(items, cart.delivery);
}
