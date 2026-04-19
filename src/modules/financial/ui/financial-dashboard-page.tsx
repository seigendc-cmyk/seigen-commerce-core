"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardTopBar } from "@/components/dashboard/dashboard-top-bar";
import {
  COGS_RESERVES_LEDGER_EVENT,
  cogsReservesLedgerStorageKey,
  listCogsReservesEntries,
  totalCogsReservesBalance,
  type CogsReservesEntry,
} from "@/modules/financial/services/cogs-reserves-ledger";
import {
  FINANCIAL_DEFAULT_TAB,
  FINANCIAL_TABS,
  normalizeFinancialTab,
  type FinancialTabId,
} from "@/modules/financial/financial-nav";

function money(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function CogsReservesCard({ entries }: { entries: CogsReservesEntry[] }) {
  const balance = useMemo(() => totalCogsReservesBalance(), [entries]);

  return (
    <section className="vendor-panel-soft rounded-2xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">COGS Reserves</h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-300">
            Cost of goods sold isolated from POS revenue. Each completed sale posts landed unit cost × quantity here
            (average cost when set, otherwise unit cost). Revenue and cash remain in your POS flow; this card is the
            cost layer for planning and export.
          </p>
        </div>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-200/90">Reserve balance</p>
          <p className="mt-1 font-mono text-2xl font-bold text-white">{money(balance)}</p>
        </div>
      </div>

      <p className="mt-4 text-xs text-neutral-500">
        Storage: <span className="font-mono">{cogsReservesLedgerStorageKey()}</span>
      </p>

      <div className="mt-6 overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.04] text-xs font-semibold uppercase tracking-wide text-neutral-400">
            <tr>
              <th className="px-3 py-2">Receipt</th>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2 text-right">COGS</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-8 text-center text-neutral-400">
                  No postings yet. Complete a sale in{" "}
                  <Link href="/dashboard/pos" className="font-semibold text-brand-orange hover:underline">
                    Point of sale
                  </Link>{" "}
                  to build COGS Reserves.
                </td>
              </tr>
            ) : (
              entries.map((e) => (
                <tr key={e.id} className="border-b border-white/[0.06] last:border-0">
                  <td className="px-3 py-2.5 font-mono text-neutral-200">{e.receiptNumber}</td>
                  <td className="px-3 py-2.5 text-neutral-400">
                    {new Date(e.createdAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-semibold text-white">{money(e.totalCogs)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {entries.length > 0 ? (
        <details className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-neutral-300">
          <summary className="cursor-pointer font-medium text-neutral-200">Line detail (latest sale)</summary>
          <ul className="mt-2 space-y-1 pl-4 list-disc text-neutral-400">
            {entries[0]?.lines.map((l) => (
              <li key={`${entries[0].id}-${l.productId}`}>
                {l.name} × {l.qty} @ {money(l.unitCost)} → {money(l.lineCogs)}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

export function FinancialDashboardPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = useMemo(() => normalizeFinancialTab(searchParams.get("tab")), [searchParams]);

  const [ledgerTick, setLedgerTick] = useState(0);

  const refreshLedger = useCallback(() => setLedgerTick((t) => t + 1), []);

  useEffect(() => {
    const onLedger = () => refreshLedger();
    const onStorage = (e: StorageEvent) => {
      if (e.key === cogsReservesLedgerStorageKey()) refreshLedger();
    };
    window.addEventListener(COGS_RESERVES_LEDGER_EVENT, onLedger);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(COGS_RESERVES_LEDGER_EVENT, onLedger);
      window.removeEventListener("storage", onStorage);
    };
  }, [refreshLedger]);

  const entries = useMemo(() => {
    void ledgerTick;
    return listCogsReservesEntries(100);
  }, [ledgerTick]);

  function selectTab(id: FinancialTabId) {
    const params = new URLSearchParams(searchParams.toString());
    if (id === FINANCIAL_DEFAULT_TAB) {
      params.delete("tab");
    } else {
      params.set("tab", id);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <>
      <DashboardTopBar
        title="Financial"
        subtitle="Local ledgers and seed accounts — COGS isolated for visibility and export."
      />
      <div className="flex-1 space-y-6 px-4 py-6 sm:px-6">
        <div className="-mx-1 overflow-x-auto pb-1">
          <div className="flex min-w-min flex-wrap gap-2 px-1">
            {FINANCIAL_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                title={t.hint}
                onClick={() => selectTab(t.id)}
                className={
                  tab === t.id
                    ? "vendor-seg-tab vendor-seg-tab-compact vendor-seg-tab-active shrink-0"
                    : "vendor-seg-tab vendor-seg-tab-compact vendor-seg-tab-inactive shrink-0"
                }
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {tab === "seed" ? <CogsReservesCard entries={entries} /> : null}
      </div>
    </>
  );
}
