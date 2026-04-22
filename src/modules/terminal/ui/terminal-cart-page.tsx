"use client";

import Link from "next/link";
import { useMemo } from "react";
import { incrementLine, removeLine, setLineQty } from "@/modules/pos/services/cart-service";
import { getOnHandForProduct } from "@/modules/inventory/services/product-read-model";
import { useTerminalSession } from "../state/terminal-session-context";
import { useTerminalCart } from "../state/terminal-cart-context";

function money(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function TerminalCartPage() {
  const { profile, accessCode, openShift } = useTerminalSession();
  const { cart, setCart } = useTerminalCart();
  const branchId = profile?.branchId;

  const onHandByProductId = useMemo(() => {
    const m = new Map<string, number>();
    if (!branchId) return m;
    for (const it of cart.items) {
      m.set(it.productId, getOnHandForProduct(branchId, it.productId));
    }
    return m;
  }, [cart.items, branchId]);

  return (
    <div className="space-y-4 px-3 py-4">
      {!openShift ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Open a shift on the Shift tab before checkout.
        </div>
      ) : null}
      {cart.items.length === 0 ? (
        <p className="text-center text-sm text-slate-500">Cart is empty.</p>
      ) : (
        <ul className="space-y-2">
          {cart.items.map((it) => (
            <li key={it.productId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900">{it.name}</div>
                  <div className="text-xs text-slate-500">{it.sku}</div>
                </div>
                <div className="text-right text-sm font-semibold text-slate-800">{money(it.lineTotal)}</div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-1 text-sm font-semibold"
                  onClick={() =>
                    setCart((c) => incrementLine(c, it.productId, -1, onHandByProductId.get(it.productId)))
                  }
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  className="vendor-field w-16 rounded-lg border border-slate-200 px-2 py-1 text-center text-sm"
                  value={it.qty}
                  max={onHandByProductId.get(it.productId) ?? 0}
                  onChange={(e) =>
                    setCart((c) =>
                      setLineQty(c, it.productId, Number(e.target.value), onHandByProductId.get(it.productId)),
                    )
                  }
                />
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-1 text-sm font-semibold"
                  disabled={it.qty >= (onHandByProductId.get(it.productId) ?? 0)}
                  onClick={() =>
                    setCart((c) => incrementLine(c, it.productId, 1, onHandByProductId.get(it.productId)))
                  }
                >
                  +
                </button>
                <button
                  type="button"
                  className="ml-auto text-xs font-semibold text-red-600"
                  onClick={() => setCart((c) => removeLine(c, it.productId))}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-2xl border border-slate-900/10 bg-slate-900 p-4 text-white">
        <div className="flex justify-between text-sm">
          <span className="text-slate-300">Subtotal</span>
          <span className="font-semibold">{money(cart.subtotal)}</span>
        </div>
        <Link
          href={`/terminal/${accessCode}/checkout`}
          className={`mt-4 block rounded-xl py-3 text-center text-sm font-bold ${
            cart.items.length === 0 || !openShift
              ? "pointer-events-none bg-white/10 text-white/40"
              : "bg-orange-500 text-white shadow-lg shadow-orange-900/20"
          }`}
        >
          Checkout
        </Link>
      </div>
    </div>
  );
}
