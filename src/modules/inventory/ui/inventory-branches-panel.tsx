"use client";

import { useCallback, useEffect, useState } from "react";
import { InventoryRepo, isHeadOfficeBranch } from "@/modules/inventory/services/inventory-repo";
import type { Branch } from "@/modules/inventory/types/models";

function dispatchBranchesUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("seigen-inventory-branches-updated"));
}

export function InventoryBranchesPanel() {
  const [rows, setRows] = useState<Branch[]>(() => InventoryRepo.listBranches());
  const [name, setName] = useState("");

  const refresh = useCallback(() => setRows(InventoryRepo.listBranches()), []);

  useEffect(() => {
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("seigen-inventory-branches-updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("seigen-inventory-branches-updated", refresh);
    };
  }, [refresh]);

  const trading = rows.filter((b) => !isHeadOfficeBranch(b));

  return (
    <section className="vendor-panel-soft rounded-2xl p-6">
      <h2 className="text-base font-semibold text-white">Locations (inventory)</h2>
      <p className="mt-2 max-w-3xl text-sm text-neutral-400">
        <strong className="text-neutral-200">Head office</strong> is the default admin location — it does not sell at POS
        or move stock, and is <strong className="text-neutral-200">not counted as a billable shop</strong>. Add a{" "}
        <strong className="text-neutral-200">trading shop</strong> for retail, warehouse, or counter stock and sales.
      </p>
      <ul className="mt-4 space-y-2">
        {rows.map((b) => (
          <li
            key={b.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
          >
            <span className="font-medium text-neutral-100">{b.name}</span>
            <span className="text-xs text-neutral-500">
              {isHeadOfficeBranch(b) ? (
                <span className="rounded border border-violet-500/40 bg-violet-500/15 px-2 py-0.5 text-violet-200">
                  Head office · non-billable
                </span>
              ) : (
                <span className="rounded border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-emerald-200/95">
                  Trading · billable shop
                </span>
              )}
              {b.isDefault ? (
                <span className="ml-2 text-neutral-600">Default</span>
              ) : null}
            </span>
            {!isHeadOfficeBranch(b) && !b.isDefault ? (
              <button
                type="button"
                className="text-xs font-semibold text-red-400 hover:text-red-300"
                onClick={() => {
                  if (!window.confirm(`Delete branch "${b.name}"? This cannot be undone.`)) return;
                  const r = InventoryRepo.deleteBranch(b.id);
                  if (!r.ok) window.alert(r.error);
                  dispatchBranchesUpdated();
                  refresh();
                }}
              >
                Delete
              </button>
            ) : null}
            {!isHeadOfficeBranch(b) && !b.isDefault && trading.length > 1 ? (
              <button
                type="button"
                className="text-xs font-semibold text-teal-600 hover:underline"
                onClick={() => {
                  InventoryRepo.setDefaultBranch(b.id);
                  dispatchBranchesUpdated();
                  refresh();
                }}
              >
                Set as default for POS
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-wrap items-end gap-2 border-t border-white/10 pt-4">
        <label className="block min-w-[200px] flex-1 text-sm">
          <span className="text-neutral-400">New trading shop name</span>
          <input
            className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Main store, Warehouse"
          />
        </label>
        <button
          type="button"
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
          onClick={() => {
            const n = name.trim();
            if (!n) return;
            const b = InventoryRepo.addBranch({ name: n, kind: "trading" });
            if (trading.length === 0) {
              InventoryRepo.setDefaultBranch(b.id);
            }
            setName("");
            dispatchBranchesUpdated();
            refresh();
          }}
        >
          Add trading shop
        </button>
      </div>
      {trading.length === 0 ? (
        <p className="mt-3 text-xs text-amber-200/90">
          POS, receiving, and assembly need at least one trading shop — add one above.
        </p>
      ) : null}
    </section>
  );
}
