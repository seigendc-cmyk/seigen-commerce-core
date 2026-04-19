"use client";

import { useMemo, useState } from "react";
import type { ProductSectorId } from "@/modules/inventory/types/sector";
import type { SectorConfig } from "@/modules/inventory/types/sector";

type Props = {
  sectors: readonly SectorConfig[];
  value: ProductSectorId[];
  onChange: (next: ProductSectorId[]) => void;
};

/**
 * Searchable multi-select “combo”: type to filter, pick to add chips; remove with ×.
 * At least one sector remains (falls back to `general_merchandise` when removing the last).
 */
export function SectorMultiCombo({ sectors, value, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const selectedSet = useMemo(() => new Set(value), [value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sectors.filter((s) => {
      if (selectedSet.has(s.id)) return false;
      if (!q) return true;
      return s.label.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
    });
  }, [sectors, selectedSet, query]);

  function add(id: ProductSectorId) {
    onChange([...value, id]);
    setQuery("");
    setOpen(false);
  }

  function remove(id: ProductSectorId) {
    const next = value.filter((x) => x !== id);
    onChange(next.length > 0 ? next : ["general_merchandise"]);
  }

  return (
    <div className="space-y-3">
      <div className="flex min-h-[2rem] flex-wrap gap-2">
        {value.map((id) => {
          const s = sectors.find((x) => x.id === id);
          return (
            <span
              key={id}
              className="inline-flex items-center gap-1.5 rounded-full border border-brand-orange/40 bg-brand-orange/15 px-3 py-1 text-sm text-neutral-100"
            >
              <span>{s?.label ?? id}</span>
              <button
                type="button"
                className="rounded-full px-1 text-neutral-400 hover:bg-white/10 hover:text-white"
                onClick={() => remove(id)}
                aria-label={`Remove ${s?.label ?? id}`}
              >
                ×
              </button>
            </span>
          );
        })}
      </div>

      <div className="relative">
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 180);
          }}
          placeholder="Type to search sectors, then pick one to add…"
          className="vendor-field w-full rounded-lg px-3 py-2 text-sm"
        />
        {open && filtered.length > 0 ? (
          <ul
            role="listbox"
            className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-white/15 bg-neutral-900 py-1 shadow-lg"
          >
            {filtered.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  role="option"
                  className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm text-neutral-200 hover:bg-white/10"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => add(s.id)}
                >
                  <span className="font-medium text-white">{s.label}</span>
                  <span className="text-xs text-neutral-500">
                    {s.fields.length} product form field{s.fields.length === 1 ? "" : "s"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {open && query.trim() && filtered.length === 0 ? (
          <p className="absolute z-20 mt-1 w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm text-neutral-500">
            No matching sectors (or already added).
          </p>
        ) : null}
      </div>
    </div>
  );
}
