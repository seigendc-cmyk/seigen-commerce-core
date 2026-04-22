"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Cart } from "@/modules/pos/types/pos";
import { emptyCart } from "@/modules/pos/services/cart-service";

export type TerminalCartContextValue = {
  cart: Cart;
  setCart: React.Dispatch<React.SetStateAction<Cart>>;
  resetCart: () => void;
};

const Ctx = createContext<TerminalCartContextValue | null>(null);

export function useTerminalCart(): TerminalCartContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTerminalCart must be used under TerminalCartProvider");
  return v;
}

export function TerminalCartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart>(() => emptyCart());
  const resetCart = useCallback(() => setCart(emptyCart()), []);
  const value = useMemo(() => ({ cart, setCart, resetCart }), [cart, resetCart]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
