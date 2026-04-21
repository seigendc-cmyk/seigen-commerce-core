"use client";

import { useState } from "react";
import { executeAssemblyBuild, executeDisassembly } from "../services/assembly-service";
import type { Product } from "../types/models";

type Props = {
  product: Product;
  onDone: () => void;
};

export function AssemblyOperationsPanel({ product, onDone }: Props) {
  const [buildQty, setBuildQty] = useState(1);
  const [breakQty, setBreakQty] = useState(1);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const hasAssembly = Boolean(product.bom?.assemblyInputs?.length);
  const hasBreakdown = Boolean(product.bom?.disassemblyOutputs?.length);

  if (!hasAssembly && !hasBreakdown) return null;

  function runBuild() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    const r = executeAssemblyBuild(product.id, buildQty);
    setBusy(false);
    if (r.ok) {
      setMsg(r.message);
      onDone();
    } else setErr(r.error);
  }

  function runBreak() {
    setBusy(true);
    setErr(null);
    setMsg(null);
    const r = executeDisassembly(product.id, breakQty);
    setBusy(false);
    if (r.ok) {
      setMsg(r.message);
      onDone();
    } else setErr(r.error);
  }

  return (
    <div className="vendor-panel-soft rounded-2xl p-6">
      <h2 className="text-base font-semibold text-white">Assembly &amp; disassembly (stock)</h2>
      <p className="mt-1 text-sm text-neutral-400">
        Uses the BOM <strong className="text-neutral-200">saved</strong> on this product — if you edited assembly lines
        above, save the form first. <strong className="text-neutral-300">Build</strong> consumes components and increases
        this SKU&apos;s on-hand value (weighted average cost). <strong className="text-neutral-300">Break down</strong>{" "}
        removes this SKU and allocates cost to outputs (by relative standard cost).
      </p>

      {err ? (
        <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          {err}
        </div>
      ) : null}
      {msg ? (
        <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {msg}
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {hasAssembly ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h3 className="text-sm font-semibold text-white">Build assembled stock</h3>
            <p className="mt-1 text-xs text-neutral-500">Consumes BOM components at the default branch.</p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div>
                <label className="text-xs text-neutral-500" htmlFor="asm-qty">
                  Quantity to build
                </label>
                <input
                  id="asm-qty"
                  type="number"
                  min={1}
                  step={1}
                  value={buildQty}
                  onChange={(e) => setBuildQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="vendor-field mt-1 w-28 rounded-lg px-2 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => runBuild()}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
              >
                Build
              </button>
            </div>
          </div>
        ) : null}

        {hasBreakdown ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h3 className="text-sm font-semibold text-white">Break down (disassemble)</h3>
            <p className="mt-1 text-xs text-neutral-500">Splits this SKU into BOM output lines.</p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div>
                <label className="text-xs text-neutral-500" htmlFor="brk-qty">
                  Units to break
                </label>
                <input
                  id="brk-qty"
                  type="number"
                  min={1}
                  step={1}
                  value={breakQty}
                  onChange={(e) => setBreakQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="vendor-field mt-1 w-28 rounded-lg px-2 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => runBreak()}
                className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
              >
                Break down
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
