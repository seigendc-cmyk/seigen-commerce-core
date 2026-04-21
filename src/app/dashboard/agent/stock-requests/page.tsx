"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Id } from "@/modules/inventory/types/models";
import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";
import { loadProductReadModels } from "@/modules/inventory/services/product-read-model";
import { AGENT_EVENT, listStockRequests } from "@/modules/consignment-agent/services/agent-storage";
import { submitStockRequest } from "@/modules/consignment-agent/services/agent-stock-request.service";

function useTick() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const on = () => setT((x) => x + 1);
    window.addEventListener(AGENT_EVENT, on);
    return () => window.removeEventListener(AGENT_EVENT, on);
  }, []);
  return t;
}

export default function AgentStockRequestsPage() {
  const stall = useMemo(() => InventoryRepo.getDefaultTradingBranch() ?? InventoryRepo.getDefaultBranch(), []);
  const stallBranchId = stall.id as Id;
  const actorLabel = "agent";
  const agentId = "agent_local";
  const agentName = "Agent";

  const _t = useTick();
  const rows = useMemo(
    () => listStockRequests().filter((r) => r.stallBranchId === stallBranchId).slice(0, 30),
    [_t, stallBranchId],
  );

  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [priority, setPriority] = useState<"normal" | "urgent">("normal");
  const [remarks, setRemarks] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const products = useMemo(() => loadProductReadModels({ branchId: stallBranchId }), [stallBranchId]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return products.slice(0, 40);
    return products
      .filter((p) => p.name.toLowerCase().includes(s) || (p.sku ?? "").toLowerCase().includes(s))
      .slice(0, 40);
  }, [products, q]);

  return (
    <div className="mx-auto max-w-md px-3 py-4">
      <header className="mb-3">
        <div className="text-lg font-semibold text-neutral-100">Stock requests</div>
        <div className="mt-2">
          <Link className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-100" href="/dashboard/agent">
            Back to cart
          </Link>
        </div>
      </header>

      {err ? <div className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{err}</div> : null}

      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="text-sm font-semibold text-neutral-100">New request</div>

        <div className="mt-2 flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products…"
            className="flex-1 rounded-lg border border-white/10 bg-neutral-950/40 px-3 py-2 text-base text-neutral-100"
          />
          <select
            className="rounded-lg border border-white/10 bg-neutral-950/40 px-3 py-2 text-base text-neutral-100"
            value={priority}
            onChange={(e) => setPriority(e.target.value as any)}
          >
            <option value="normal">Normal</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          {filtered.map((p) => (
            <button
              key={p.id}
              className="rounded-xl border border-white/10 bg-neutral-950/30 p-3 text-left active:bg-white/10"
              onClick={() => setSelected((m) => ({ ...m, [p.id]: Math.min(999, (m[p.id] ?? 0) + 1) }))}
            >
              <div className="truncate text-sm font-semibold text-neutral-100">{p.name}</div>
              <div className="mt-1 flex items-center justify-between text-xs text-neutral-400">
                <span className="truncate">{p.sku}</span>
                <span className="text-neutral-200">+1</span>
              </div>
              {selected[p.id] ? <div className="mt-1 text-xs text-emerald-300">Requested: {selected[p.id]}</div> : null}
            </button>
          ))}
        </div>

        <label className="mt-3 block text-xs text-neutral-400">
          Remarks
          <input
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="mt-1 w-full rounded-lg border border-white/10 bg-neutral-950/40 px-3 py-2 text-base text-neutral-100"
          />
        </label>

        <button
          className="mt-3 w-full rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-neutral-950"
          onClick={() => {
            setErr(null);
            const lines = Object.entries(selected)
              .map(([productId, qty]) => ({ productId: productId as Id, qty }))
              .filter((x) => x.qty > 0);
            const r = submitStockRequest({
              stallBranchId,
              agentId,
              agentName,
              actorLabel,
              priority,
              remarks,
              lines,
            });
            if (!r.ok) {
              setErr(r.error);
              return;
            }
            setSelected({});
            setRemarks("");
            setQ("");
          }}
        >
          Submit request
        </button>
      </div>

      <div className="mt-4 space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-sm font-semibold text-neutral-100">{r.priority.toUpperCase()} · {r.lines.length} item(s)</div>
            <div className="mt-1 text-xs text-neutral-400">{r.createdAt.slice(0, 16).replace("T", " ")}</div>
            <div className="mt-1 text-xs text-neutral-500">Status: {r.status.replaceAll("_", " ")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

