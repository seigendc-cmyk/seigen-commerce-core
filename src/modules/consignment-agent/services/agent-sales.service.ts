import type { Id } from "@/modules/inventory/types/models";
import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";
import type { ProductReadModel } from "@/modules/inventory/types/product-read-model";
import type { Cart } from "@/modules/pos/types/pos";
import { addOrIncrementFromProduct, emptyCart, incrementLine, removeLine, setLineQty } from "@/modules/pos/services/cart-service";
import { validateStockForCart } from "@/modules/pos/services/stock-validation";
import { listShifts, upsertSale } from "./agent-storage";
import type { AgentSale } from "../types/agent";

function uid(p: string): string {
  return `${p}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}
function nowIso(): string {
  return new Date().toISOString();
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function emptyAgentCart(): Cart {
  return emptyCart();
}

export function agentCartAdd(cart: Cart, product: ProductReadModel, stallBranchId: Id, addQty = 1): { ok: true; cart: Cart } | { ok: false; error: string; cart: Cart } {
  const next = addOrIncrementFromProduct(cart, product, addQty);
  const err = validateStockForCart(next, stallBranchId);
  if (err) return { ok: false, error: err, cart };
  return { ok: true, cart: next };
}

export function agentCartSetQty(cart: Cart, productId: string, qty: number, stallBranchId: Id): { ok: true; cart: Cart } | { ok: false; error: string; cart: Cart } {
  const max = InventoryRepo.getStock(stallBranchId, productId as Id)?.onHandQty ?? undefined;
  const next = setLineQty(cart, productId, qty, max);
  const err = validateStockForCart(next, stallBranchId);
  if (err) return { ok: false, error: err, cart };
  return { ok: true, cart: next };
}

export function agentCartInc(cart: Cart, productId: string, delta: number, stallBranchId: Id): { ok: true; cart: Cart } | { ok: false; error: string; cart: Cart } {
  const max = InventoryRepo.getStock(stallBranchId, productId as Id)?.onHandQty ?? undefined;
  const next = incrementLine(cart, productId, delta, max);
  const err = validateStockForCart(next, stallBranchId);
  if (err) return { ok: false, error: err, cart };
  return { ok: true, cart: next };
}

export function agentCartRemove(cart: Cart, productId: string): Cart {
  return removeLine(cart, productId);
}

export function completeAgentCashSale(input: {
  stallBranchId: Id;
  actorLabel: string;
  agentId: string;
  agentName: string;
  shiftId: string | null;
  cart: Cart;
  amountPaid: number;
  paymentMethod: "cash" | "momo" | "bank_transfer";
  customerLabel?: string;
}): { ok: true; sale: AgentSale } | { ok: false; error: string } {
  if (input.cart.items.length < 1) return { ok: false, error: "Add at least one item." };
  const err = validateStockForCart(input.cart, input.stallBranchId);
  if (err) return { ok: false, error: err };

  const subtotal = round2(input.cart.subtotal);
  const paid = round2(Math.max(0, input.amountPaid));
  if (paid < subtotal) return { ok: false, error: "Amount paid is less than total." };

  // Prefer sales inside an open shift, but allow if shiftId is null.
  if (input.shiftId) {
    const sh = listShifts().find((s) => s.id === input.shiftId);
    if (!sh || sh.status !== "open") return { ok: false, error: "Shift is not open." };
    if (sh.stallBranchId !== input.stallBranchId) return { ok: false, error: "Shift stall mismatch." };
  }

  // Reserve stock reduction: use inventory repo adjustment (same as POS).
  for (const it of input.cart.items) {
    InventoryRepo.incrementStock(input.stallBranchId, it.productId as Id, -Math.floor(it.qty));
  }

  const sale: AgentSale = {
    id: uid("asale"),
    stallBranchId: input.stallBranchId,
    shiftId: input.shiftId,
    createdAt: nowIso(),
    createdByLabel: input.actorLabel,
    status: "completed",
    items: input.cart.items,
    subtotal,
    amountPaid: paid,
    paymentMethod: input.paymentMethod,
    customerLabel: input.customerLabel?.trim() || undefined,
  };
  upsertSale(sale);
  return { ok: true, sale };
}

