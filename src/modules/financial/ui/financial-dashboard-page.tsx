"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardTopBar } from "@/components/dashboard/dashboard-top-bar";
import { bankAccountLedgerStorageKey } from "@/modules/financial/services/bank-account-ledger";
import { cashBookLedgerStorageKey } from "@/modules/financial/services/cash-book-ledger";
import {
  COGS_RESERVES_LEDGER_EVENT,
  cogsReservesLedgerStorageKey,
  listCogsReservesEntries,
  totalCogsReservesBalance,
  type CogsReservesEntry,
} from "@/modules/financial/services/cogs-reserves-ledger";
import { balanceBySupplierId, creditorsLedgerStorageKey, listCreditorEntries } from "@/modules/financial/services/creditors-ledger";
import { FINANCIAL_LEDGERS_UPDATED_EVENT } from "@/modules/financial/services/financial-events";
import { generalJournalStorageKey } from "@/modules/financial/services/general-journal-ledger";
import { stockAdjustmentLedgerStorageKey } from "@/modules/financial/services/stock-adjustment-ledger";
import { CashBookTab } from "@/modules/financial/ui/cash-book-tab";
import { StockAdjustmentsTab } from "@/modules/financial/ui/stock-adjustments-tab";
import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";
import {
  FINANCIAL_DEFAULT_TAB,
  FINANCIAL_TABS,
  normalizeFinancialTab,
  type FinancialTabId,
} from "@/modules/financial/financial-nav";

function money(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function entryKindLabel(k: CogsReservesEntry["entryKind"]): string {
  switch (k) {
    case "po_cash":
      return "PO (cash)";
    case "transfer_in_cash":
      return "Transfer in (cash)";
    case "transfer_in_bank":
      return "Transfer in (bank)";
    case "transfer_out_cash":
      return "Transfer out (cash)";
    case "creditor_payment":
      return "Supplier AP (COGS)";
    case "sale":
      return "POS sale";
    default:
      return "POS sale";
  }
}

function CogsReservesCard({ entries }: { entries: CogsReservesEntry[] }) {
  const balance = useMemo(() => totalCogsReservesBalance(), [entries]);

  return (
    <section className="vendor-panel-soft rounded-2xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">COGS Reserves</h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-300">
            Inventory funding pool: POS sales increase the reserve (cost layer); cash purchase orders and transfers out
            reduce it. Fund from Cash Book or Bank using the CashBook tab.
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
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.04] text-xs font-semibold uppercase tracking-wide text-neutral-400">
            <tr>
              <th className="px-3 py-2">Ref</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-neutral-400">
                  No movements yet. Sell on{" "}
                  <Link href="/dashboard/pos" className="font-semibold text-brand-orange hover:underline">
                    POS
                  </Link>{" "}
                  or fund from CashBook.
                </td>
              </tr>
            ) : (
              entries.map((e) => (
                <tr key={e.id} className="border-b border-white/[0.06] last:border-0">
                  <td className="px-3 py-2.5 font-mono text-neutral-200">{e.receiptNumber ?? e.saleId ?? "—"}</td>
                  <td className="px-3 py-2.5 text-neutral-400">{entryKindLabel(e.entryKind)}</td>
                  <td className="px-3 py-2.5 text-neutral-400">
                    {new Date(e.createdAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                  <td
                    className={[
                      "px-3 py-2.5 text-right font-mono font-semibold",
                      e.totalCogs >= 0 ? "text-emerald-200" : "text-rose-200",
                    ].join(" ")}
                  >
                    {e.totalCogs >= 0 ? "+" : ""}
                    {money(e.totalCogs)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {entries.length > 0 && entries[0]?.entryKind === "sale" && entries[0].lines.length > 0 ? (
        <details className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-neutral-300">
          <summary className="cursor-pointer font-medium text-neutral-200">Line detail (latest sale)</summary>
          <ul className="mt-2 space-y-1 pl-4 list-disc text-neutral-400">
            {entries[0].lines.map((l) => (
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

function CreditorsTab({ tick }: { tick: number }) {
  void tick;
  const entries = useMemo(() => listCreditorEntries(200), [tick]);
  const balances = useMemo(() => balanceBySupplierId(), [tick]);

  const cards = useMemo(() => {
    const rows: { supplierId: string; name: string; balance: number }[] = [];
    for (const [supplierId, balance] of balances) {
      if (balance <= 0) continue;
      const s = InventoryRepo.getSupplier(supplierId);
      rows.push({ supplierId, name: s?.name ?? supplierId, balance });
    }
    return rows.sort((a, b) => b.balance - a.balance);
  }, [balances]);

  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-neutral-400">
        Credit purchase orders increase amounts owed to each supplier (accounts payable). Cash POs settle from COGS
        Reserves instead and do not appear here.
      </p>
      <p className="text-xs text-neutral-500">
        Storage: <span className="font-mono">{creditorsLedgerStorageKey()}</span>
      </p>

      {cards.length === 0 ? (
        <p className="text-sm text-neutral-400">
          No creditor balances. Mark a PO as{" "}
          <span className="text-neutral-200">Credit</span> on the purchasing screen, then mark it ordered.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((c) => (
            <section
              key={c.supplierId}
              className="rounded-2xl border border-rose-500/25 bg-rose-500/[0.06] p-5"
            >
              <h3 className="text-sm font-semibold text-white">{c.name}</h3>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-rose-200/80">Creditor balance</p>
              <p className="mt-2 font-mono text-2xl font-bold text-white">{money(c.balance)}</p>
              <p className="mt-3 text-xs text-neutral-500">Supplier id · {c.supplierId.slice(-12)}</p>
            </section>
          ))}
        </div>
      )}

      <section className="vendor-panel-soft rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white">Creditor postings</h2>
        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.04] text-xs font-semibold uppercase tracking-wide text-neutral-400">
              <tr>
                <th className="px-3 py-2">Supplier</th>
                <th className="px-3 py-2">Document</th>
                <th className="px-3 py-2">Invoice</th>
                <th className="px-3 py-2">Due</th>
                <th className="px-3 py-2 text-right">AP</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-neutral-400">
                    No credit PO postings yet.
                  </td>
                </tr>
              ) : (
                entries.map((e) => (
                  <tr key={e.id} className="border-b border-white/[0.06] last:border-0">
                    <td className="px-3 py-2.5 text-neutral-200">{e.supplierName}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-neutral-400">{e.poReference}</td>
                    <td className="px-3 py-2.5 text-neutral-400">
                      {new Date(e.invoiceDate).toLocaleDateString(undefined, { dateStyle: "medium" })}
                    </td>
                    <td className="px-3 py-2.5 text-neutral-400">
                      {new Date(e.dueDate).toLocaleDateString(undefined, { dateStyle: "medium" })}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-white">{money(e.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
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
    const onAny = () => refreshLedger();
    const onStorage = (e: StorageEvent) => {
      const keys = [
        cogsReservesLedgerStorageKey(),
        creditorsLedgerStorageKey(),
        cashBookLedgerStorageKey(),
        bankAccountLedgerStorageKey(),
        generalJournalStorageKey(),
        stockAdjustmentLedgerStorageKey(),
      ];
      if (e.key && keys.includes(e.key)) refreshLedger();
    };
    window.addEventListener(COGS_RESERVES_LEDGER_EVENT, onAny);
    window.addEventListener(FINANCIAL_LEDGERS_UPDATED_EVENT, onAny);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(COGS_RESERVES_LEDGER_EVENT, onAny);
      window.removeEventListener(FINANCIAL_LEDGERS_UPDATED_EVENT, onAny);
      window.removeEventListener("storage", onStorage);
    };
  }, [refreshLedger]);

  const cogsEntries = useMemo(() => {
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
        subtitle="COGS Reserves, creditors, cash/bank, stock adjustments, and journals — local-first."
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

        {tab === "seed" ? <CogsReservesCard entries={cogsEntries} /> : null}
        {tab === "creditors" ? <CreditorsTab tick={ledgerTick} /> : null}
        {tab === "cashbook" ? <CashBookTab tick={ledgerTick} onRefresh={refreshLedger} /> : null}
        {tab === "stock-adjustments" ? <StockAdjustmentsTab tick={ledgerTick} /> : null}
      </div>
    </>
  );
}
