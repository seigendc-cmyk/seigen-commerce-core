"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useWorkspace } from "@/components/dashboard/workspace-context";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  biRulesLocalStorageKey,
  listBiRules,
  removeBiRule,
  upsertBiRule,
  type BiBusinessRule,
  type BiRuleDomain,
} from "@/modules/bi/services/bi-rules-local";

const DOMAINS: { id: BiRuleDomain; label: string }[] = [
  { id: "inventory", label: "Inventory" },
  { id: "sales", label: "Sales" },
  { id: "staff", label: "Staff" },
  { id: "delivery", label: "Delivery" },
  { id: "financial", label: "Financial" },
  { id: "other", label: "Other" },
];

export function BiRulesPage() {
  const workspace = useWorkspace();
  const [tick, setTick] = useState(0);
  const rules = useMemo(() => {
    void tick;
    return listBiRules();
  }, [tick]);

  const [editing, setEditing] = useState<BiBusinessRule | null>(null);
  const [configStr, setConfigStr] = useState("{}");
  const [jsonErr, setJsonErr] = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setConfigStr(JSON.stringify(editing.config, null, 2));
      setJsonErr(null);
    }
  }, [editing]);

  const supabaseReady = isSupabaseConfigured() && !!workspace?.tenant?.id;

  return (
    <div className="flex-1 space-y-6 px-4 py-6 sm:px-6">
      <div>
        <p className="max-w-3xl text-sm leading-relaxed text-neutral-300">
          Central place for <span className="text-neutral-100">routable policies</span> (inventory, sales, staff,
          delivery, …). The app reads these rules to drive advisories, scheduled checks, and approvals. Data is stored
          locally first; use Supabase for multi-device truth after migration.
        </p>
        <p className="mt-2 text-xs text-neutral-500">
          Migration: <span className="font-mono">supabase/migrations/20260419240000_bi_business_rules.sql</span>
        </p>
        {!supabaseReady ? (
          <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            Supabase + tenant not fully linked — editing uses{" "}
            <span className="font-mono text-amber-50">{biRulesLocalStorageKey()}</span> in this browser.
          </p>
        ) : (
          <p className="mt-2 text-xs text-emerald-200/90">
            Tenant <span className="font-mono">{workspace?.tenant?.id?.slice(0, 8)}…</span> — wire server sync when you
            connect CRUD to <span className="font-mono">bi_business_rules</span>.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/dashboard/inventory?tab=stocktake"
          className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:border-brand-orange"
        >
          Inventory stocktake →
        </Link>
      </div>

      <section className="vendor-panel-soft rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-white">Rules</h2>
          <button
            type="button"
            className="rounded-lg bg-brand-orange px-3 py-2 text-sm font-semibold text-white hover:bg-brand-orange-hover"
            onClick={() =>
              setEditing({
                id: "",
                domain: "inventory",
                ruleKey: `custom.${Date.now()}`,
                title: "New rule",
                description: "",
                config: {},
                isActive: true,
                updatedAt: new Date().toISOString(),
              })
            }
          >
            Add rule
          </button>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.04] text-xs font-semibold uppercase text-neutral-400">
              <tr>
                <th className="px-3 py-2">Domain</th>
                <th className="px-3 py-2">Key</th>
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Active</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-b border-white/[0.06] last:border-0">
                  <td className="px-3 py-2.5 text-neutral-300">{r.domain}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-neutral-500">{r.ruleKey}</td>
                  <td className="px-3 py-2.5 text-neutral-200">{r.title}</td>
                  <td className="px-3 py-2.5">{r.isActive ? "Yes" : "No"}</td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      type="button"
                      className="text-sm font-semibold text-brand-orange hover:underline"
                      onClick={() => setEditing(r)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog">
          <div className="vendor-panel max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white">{editing.id ? "Edit rule" : "New rule"}</h3>
            <div className="mt-4 space-y-3 text-sm">
              <label className="block">
                <span className="text-neutral-400">Domain</span>
                <select
                  className="vendor-field mt-1 w-full rounded-lg px-2 py-2"
                  value={editing.domain}
                  onChange={(e) => setEditing({ ...editing, domain: e.target.value as BiRuleDomain })}
                >
                  {DOMAINS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-neutral-400">Rule key</span>
                <input
                  className="vendor-field mt-1 w-full rounded-lg px-2 py-2 font-mono text-xs"
                  value={editing.ruleKey}
                  onChange={(e) => setEditing({ ...editing, ruleKey: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-neutral-400">Title</span>
                <input
                  className="vendor-field mt-1 w-full rounded-lg px-2 py-2"
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-neutral-400">Description</span>
                <textarea
                  className="vendor-field mt-1 min-h-[80px] w-full rounded-lg px-2 py-2 text-sm"
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-neutral-400">Config (JSON)</span>
                <textarea
                  className="vendor-field mt-1 min-h-[120px] w-full rounded-lg px-2 py-2 font-mono text-xs"
                  value={configStr}
                  onChange={(e) => setConfigStr(e.target.value)}
                />
              </label>
              {jsonErr ? <p className="text-xs text-amber-300">{jsonErr}</p> : null}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editing.isActive}
                  onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })}
                />
                <span className="text-neutral-300">Active</span>
              </label>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              {editing.id ? (
                <button
                  type="button"
                  className="rounded-lg border border-rose-500/40 px-4 py-2 text-sm text-rose-200 hover:bg-rose-500/10"
                  onClick={() => {
                    removeBiRule(editing.id);
                    setEditing(null);
                    setTick((t) => t + 1);
                  }}
                >
                  Delete
                </button>
              ) : null}
              <button
                type="button"
                className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white hover:border-brand-orange"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-white hover:bg-brand-orange-hover"
                onClick={() => {
                  let config: Record<string, unknown> = {};
                  try {
                    config = JSON.parse(configStr.trim() || "{}") as Record<string, unknown>;
                  } catch {
                    setJsonErr("Invalid JSON in config.");
                    return;
                  }
                  upsertBiRule({ ...editing, config });
                  setEditing(null);
                  setTick((t) => t + 1);
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
