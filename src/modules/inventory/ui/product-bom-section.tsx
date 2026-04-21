"use client";

import type { BomLine } from "../types/models";

type ProductOption = { id: string; sku: string; name: string };

type Props = {
  productOptions: ProductOption[];
  /** Current product id — excluded from component/output pickers */
  selfProductId?: string;
  assemblyLines: BomLine[];
  onAssemblyChange: (lines: BomLine[]) => void;
  disassemblyLines: BomLine[];
  onDisassemblyChange: (lines: BomLine[]) => void;
};

function emptyLine(): BomLine {
  return { productId: "", qty: 1, label: "" };
}

export function ProductBomSection({
  productOptions,
  selfProductId,
  assemblyLines,
  onAssemblyChange,
  disassemblyLines,
  onDisassemblyChange,
}: Props) {
  const pickable = productOptions.filter((p) => p.id !== selfProductId);

  function updateAssembly(i: number, patch: Partial<BomLine>) {
    const next = assemblyLines.map((row, j) => (j === i ? { ...row, ...patch } : row));
    onAssemblyChange(next);
  }

  function updateDisassembly(i: number, patch: Partial<BomLine>) {
    const next = disassemblyLines.map((row, j) => (j === i ? { ...row, ...patch } : row));
    onDisassemblyChange(next);
  }

  return (
    <div className="vendor-panel rounded-2xl p-6">
      <h2 className="text-base font-semibold text-white">Assembly &amp; breakdown (BOM)</h2>
      <p className="mt-1 text-sm text-neutral-400">
        <strong className="text-neutral-300">Assembly</strong> — this SKU is built from other stocked parts (each row is
        consumed per 1 unit you build). <strong className="text-neutral-300">Breakdown</strong> — disassembling 1 unit of
        this SKU puts tanks, cores, scrap, or purchased parts back into stock (e.g. radiator rebuilds). Stock moves run
        from the product screen after you save.
      </p>

      <div className="mt-6 border-t border-white/10 pt-5">
        <h3 className="text-sm font-semibold text-white">Built from (components per 1 assembled unit)</h3>
        <p className="mt-1 text-xs text-neutral-500">
          Example: one assembled radiator uses 1× core, 2× tanks, hardware kit. Quantities can be fractional (e.g. 0.5 kg).
        </p>
        {assemblyLines.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">
            No assembly BOM yet.{" "}
            <button
              type="button"
              onClick={() => onAssemblyChange([emptyLine()])}
              className="font-medium text-teal-600 hover:underline"
            >
              Add component row
            </button>
          </p>
        ) : (
        <ul className="mt-3 space-y-3">
          {assemblyLines.map((row, i) => (
            <li key={`a-${i}`} className="flex flex-wrap items-end gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <div className="min-w-[200px] flex-1">
                <label className="text-xs text-neutral-500">Component SKU</label>
                <select
                  value={row.productId}
                  onChange={(e) => updateAssembly(i, { productId: e.target.value })}
                  className="vendor-field mt-1 w-full rounded-lg px-2 py-2 text-sm"
                >
                  <option value="">Select product…</option>
                  {pickable.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-24">
                <label className="text-xs text-neutral-500">Qty</label>
                <input
                  type="number"
                  min={0.0001}
                  step="any"
                  value={row.qty}
                  onChange={(e) => updateAssembly(i, { qty: Number(e.target.value) })}
                  className="vendor-field mt-1 w-full rounded-lg px-2 py-2 text-sm"
                />
              </div>
              <div className="min-w-[140px] flex-1">
                <label className="text-xs text-neutral-500">Label (optional)</label>
                <input
                  value={row.label ?? ""}
                  onChange={(e) => updateAssembly(i, { label: e.target.value })}
                  placeholder="e.g. Upper tank"
                  className="vendor-field mt-1 w-full rounded-lg px-2 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => onAssemblyChange(assemblyLines.filter((_, j) => j !== i))}
                className="mb-0.5 text-xs text-neutral-400 hover:text-white"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        )}
        {assemblyLines.length > 0 ? (
        <button
          type="button"
          onClick={() => onAssemblyChange([...assemblyLines, emptyLine()])}
          className="mt-2 text-sm font-medium text-teal-600 hover:underline"
        >
          + Add component
        </button>
        ) : null}
      </div>

      <div className="mt-8 border-t border-white/10 pt-5">
        <h3 className="text-sm font-semibold text-white">Breakdown outputs (per 1 unit disassembled)</h3>
        <p className="mt-1 text-xs text-neutral-500">
          When you strip a core unit, list each stocked output (reuse purchased tanks, add scrap lines, etc.).
        </p>
        {disassemblyLines.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">
            No breakdown BOM yet.{" "}
            <button
              type="button"
              onClick={() => onDisassemblyChange([emptyLine()])}
              className="font-medium text-teal-600 hover:underline"
            >
              Add output row
            </button>
          </p>
        ) : (
        <ul className="mt-3 space-y-3">
          {disassemblyLines.map((row, i) => (
            <li key={`d-${i}`} className="flex flex-wrap items-end gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <div className="min-w-[200px] flex-1">
                <label className="text-xs text-neutral-500">Output SKU</label>
                <select
                  value={row.productId}
                  onChange={(e) => updateDisassembly(i, { productId: e.target.value })}
                  className="vendor-field mt-1 w-full rounded-lg px-2 py-2 text-sm"
                >
                  <option value="">Select product…</option>
                  {pickable.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-24">
                <label className="text-xs text-neutral-500">Qty</label>
                <input
                  type="number"
                  min={0.0001}
                  step="any"
                  value={row.qty}
                  onChange={(e) => updateDisassembly(i, { qty: Number(e.target.value) })}
                  className="vendor-field mt-1 w-full rounded-lg px-2 py-2 text-sm"
                />
              </div>
              <div className="min-w-[140px] flex-1">
                <label className="text-xs text-neutral-500">Label (optional)</label>
                <input
                  value={row.label ?? ""}
                  onChange={(e) => updateDisassembly(i, { label: e.target.value })}
                  placeholder="e.g. Brass scrap"
                  className="vendor-field mt-1 w-full rounded-lg px-2 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() => onDisassemblyChange(disassemblyLines.filter((_, j) => j !== i))}
                className="mb-0.5 text-xs text-neutral-400 hover:text-white"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        )}
        {disassemblyLines.length > 0 ? (
        <button
          type="button"
          onClick={() => onDisassemblyChange([...disassemblyLines, emptyLine()])}
          className="mt-2 text-sm font-medium text-teal-600 hover:underline"
        >
          + Add output line
        </button>
        ) : null}
      </div>
    </div>
  );
}
