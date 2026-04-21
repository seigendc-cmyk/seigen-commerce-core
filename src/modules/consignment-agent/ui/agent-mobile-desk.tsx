"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Id } from "@/modules/inventory/types/models";
import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";
import { loadProductReadModels } from "@/modules/inventory/services/product-read-model";
import type { ProductReadModel } from "@/modules/inventory/types/product-read-model";
import type { Cart } from "@/modules/pos/types/pos";
import { AGENT_EVENT, listAgentNotifications, listRemittances, listSales, listShifts } from "../services/agent-storage";
import { openShift, closeShift, listOpenShiftForStall } from "../services/agent-shift.service";
import {
  agentCartAdd,
  agentCartInc,
  agentCartRemove,
  agentCartSetQty,
  completeAgentCashSale,
  emptyAgentCart,
} from "../services/agent-sales.service";

function useAgentDbTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const on = () => setTick((t) => t + 1);
    window.addEventListener(AGENT_EVENT, on);
    return () => window.removeEventListener(AGENT_EVENT, on);
  }, []);
  return tick;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function AgentMobileDesk() {
  // Phase 1 (local-first): choose stall as default trading branch.
  const stall = useMemo(() => InventoryRepo.getDefaultTradingBranch() ?? InventoryRepo.getDefaultBranch(), []);
  const stallBranchId = stall.id as Id;

  // Phase 1 (local-first): operator label placeholder (wired to auth later).
  const agentId = "agent_local";
  const agentName = "Agent";
  const actorLabel = "agent";

  const _tick = useAgentDbTick();

  const [q, setQ] = useState("");
  const [cart, setCart] = useState<Cart>(() => emptyAgentCart());
  const [err, setErr] = useState<string | null>(null);
  const [paid, setPaid] = useState<number>(0);

  const products = useMemo(() => loadProductReadModels({ branchId: stallBranchId }), [stallBranchId]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return products.slice(0, 60);
    return products
      .filter((p) => {
        if (p.name.toLowerCase().includes(s)) return true;
        if ((p.sku ?? "").toLowerCase().includes(s)) return true;
        if ((p.barcode ?? "").toLowerCase().includes(s)) return true;
        if ((p.upc ?? "").toLowerCase().includes(s)) return true;
        return false;
      })
      .slice(0, 60);
  }, [products, q]);

  const openShiftRow = useMemo(() => listOpenShiftForStall(stallBranchId), [_tick, stallBranchId]);
  const salesToday = useMemo(() => {
    const day = new Date().toISOString().slice(0, 10);
    return listSales().filter((s) => s.stallBranchId === stallBranchId && s.createdAt.slice(0, 10) === day && s.status === "completed");
  }, [_tick, stallBranchId]);
  const salesTotal = useMemo(() => round2(salesToday.reduce((t, s) => t + s.subtotal, 0)), [salesToday]);

  const pendingAcks = useMemo(
    () => listRemittances().filter((r) => r.stallBranchId === stallBranchId && r.status === "received_approved"),
    [_tick, stallBranchId],
  );

  const notifications = useMemo(() => listAgentNotifications().slice(0, 10), [_tick]);

  useEffect(() => {
    setPaid(cart.subtotal);
  }, [cart.subtotal]);

  function add(p: ProductReadModel) {
    const res = agentCartAdd(cart, p, stallBranchId, 1);
    if (!res.ok) setErr(res.error);
    else setErr(null);
    setCart(res.cart);
  }

  return (
    <div className="mx-auto max-w-md px-3 pb-24 pt-3">
      <header className="sticky top-0 z-10 -mx-3 mb-3 border-b border-white/10 bg-neutral-950/90 px-3 pb-3 pt-3 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-neutral-400">Agent desk</div>
            <div className="truncate text-lg font-semibold text-neutral-100">{stall.name}</div>
            <div className="mt-1 text-xs text-neutral-400">
              Operator: <span className="text-neutral-200">{agentName}</span>{" "}
              <span className="text-neutral-500">({actorLabel})</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-neutral-400">Shift</div>
            <div className={openShiftRow ? "text-sm font-semibold text-emerald-300" : "text-sm font-semibold text-neutral-300"}>
              {openShiftRow ? "OPEN" : "CLOSED"}
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-semibold text-neutral-100 active:bg-white/10 disabled:opacity-50"
            disabled={Boolean(openShiftRow)}
            onClick={() => {
              const r = openShift({ stallBranchId, agentId, agentName, actorLabel });
              setErr(r.ok ? null : r.error);
            }}
          >
            Open shift
          </button>
          <button
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-semibold text-neutral-100 active:bg-white/10 disabled:opacity-50"
            disabled={!openShiftRow}
            onClick={() => {
              if (!openShiftRow) return;
              const r = closeShift({ shiftId: openShiftRow.id, actorLabel });
              setErr(r.ok ? null : r.error);
            }}
          >
            Close shift
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-neutral-400">
          <div>
            Sales today: <span className="text-neutral-200">{salesTotal.toFixed(2)}</span>
          </div>
          <div>
            Pending ack: <span className="text-neutral-200">{pendingAcks.length}</span>
          </div>
        </div>
      </header>

      {err ? <div className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{err}</div> : null}

      <div className="mb-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search product / SKU / barcode…"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-base text-neutral-100 placeholder:text-neutral-500 outline-none focus:border-white/20"
          inputMode="search"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {filtered.map((p) => (
          <button
            key={p.id}
            className="rounded-xl border border-white/10 bg-white/5 p-3 text-left active:bg-white/10"
            onClick={() => add(p)}
          >
            <div className="truncate text-sm font-semibold text-neutral-100">{p.name}</div>
            <div className="mt-1 flex items-center justify-between text-xs text-neutral-400">
              <span className="truncate">{p.sku}</span>
              <span className="text-neutral-200">{p.sellingPrice.toFixed(2)}</span>
            </div>
            <div className="mt-1 text-xs text-neutral-500">On hand: {Math.floor(p.onHandQty)}</div>
          </button>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-white/10 bg-neutral-950/95 backdrop-blur">
        <div className="mx-auto max-w-md px-3 py-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-neutral-400">Total</div>
              <div className="text-2xl font-semibold text-neutral-100">{cart.subtotal.toFixed(2)}</div>
            </div>
            <button
              className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-neutral-950 disabled:opacity-50"
              disabled={cart.items.length < 1 || (openShiftRow ? false : true)}
              onClick={() => {
                setErr(null);
                const r = completeAgentCashSale({
                  stallBranchId,
                  actorLabel,
                  agentId,
                  agentName,
                  shiftId: openShiftRow?.id ?? null,
                  cart,
                  amountPaid: paid,
                  paymentMethod: "cash",
                });
                if (!r.ok) {
                  setErr(r.error);
                  return;
                }
                setCart(emptyAgentCart());
              }}
            >
              Complete sale
            </button>
          </div>

          <div className="mt-2 flex gap-2">
            <Link
              href="/dashboard/agent/remittances"
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-sm font-semibold text-neutral-100"
            >
              Remittances
            </Link>
            <Link
              href="/dashboard/agent/stock-requests"
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-sm font-semibold text-neutral-100"
            >
              Stock requests
            </Link>
            <Link
              href="/dashboard/agent/notifications"
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-sm font-semibold text-neutral-100"
            >
              Alerts ({notifications.filter((n) => !n.readAt).length})
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

