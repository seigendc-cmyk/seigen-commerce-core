"use client";

import { useEffect, useMemo, useState } from "react";
import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";
import { listProductReadModels } from "@/modules/inventory/services/product-read-model";
import { listSales } from "@/modules/pos/services/sales-service";
import { listDebtorEntriesForCustomer, balanceByCustomerId } from "@/modules/financial/services/debtors-ledger";
import { getConsignmentAgreementByStallBranchId } from "@/modules/consignment/services/consignment-agreements";
import type { AgentContext } from "@/modules/agent/ui/agent-gate";

function money(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function AgentDeskPage({ ctx }: { ctx: AgentContext }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const onAny = () => setTick((t) => t + 1);
    window.addEventListener("storage", onAny);
    window.addEventListener("seigen-consignment-updated", onAny);
    window.addEventListener("seigen-financial-ledgers-updated", onAny as any);
    window.addEventListener("seigen-pos-sale-recorded", onAny as any);
    return () => {
      window.removeEventListener("storage", onAny);
      window.removeEventListener("seigen-consignment-updated", onAny);
      window.removeEventListener("seigen-financial-ledgers-updated", onAny as any);
      window.removeEventListener("seigen-pos-sale-recorded", onAny as any);
    };
  }, []);

  const stall = useMemo(() => InventoryRepo.getBranch(ctx.stallBranchId), [ctx.stallBranchId]);
  const agreement = useMemo(() => {
    void tick;
    return getConsignmentAgreementByStallBranchId(ctx.stallBranchId);
  }, [ctx.stallBranchId, tick]);

  const stock = useMemo(() => {
    void tick;
    return listProductReadModels(ctx.stallBranchId).slice().sort((a, b) => a.name.localeCompare(b.name));
  }, [ctx.stallBranchId, tick]);

  const sales = useMemo(() => {
    void tick;
    return listSales().filter((s) => s.branchId === ctx.stallBranchId).slice(0, 50);
  }, [ctx.stallBranchId, tick]);

  const debtorSummary = useMemo(() => {
    void tick;
    const agentId = agreement?.agentId;
    if (!agentId) return { balance: 0, entries: [] as ReturnType<typeof listDebtorEntriesForCustomer> };
    const balance = balanceByCustomerId().get(agentId) ?? 0;
    const entries = listDebtorEntriesForCustomer(agentId).slice(0, 20);
    return { balance, entries };
  }, [agreement?.agentId, tick]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold tracking-wider text-slate-500">Agent</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">{ctx.user.email ?? "Agent"}</div>
            <div className="mt-1 text-sm text-slate-600">
              Stall: <span className="font-semibold text-slate-800">{stall?.name ?? ctx.stallBranchId}</span>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold text-slate-600">Outstanding settlement (AR)</div>
            <div className="mt-1 text-xl font-mono font-semibold text-slate-900">{money(debtorSummary.balance)}</div>
            <div className="mt-1 text-xs text-slate-500">Governed by seiGEN Commerce records</div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Stock list (stall)</h2>
          <p className="mt-1 text-xs text-slate-600">Live stock visibility for your stall branch.</p>
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2 text-right">On hand</th>
                  <th className="px-3 py-2 text-right">Sell</th>
                </tr>
              </thead>
              <tbody>
                {stock.slice(0, 120).map((p) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-mono text-xs text-slate-700">{p.sku}</td>
                    <td className="px-3 py-2 text-slate-900">{p.name}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-800">{p.onHandQty}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-800">{money(p.sellingPrice)}</td>
                  </tr>
                ))}
                {stock.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-sm text-slate-600" colSpan={4}>
                      No stock found for this stall yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Recent sales (stall)</h2>
          <p className="mt-1 text-xs text-slate-600">Latest completed receipts recorded from your stall POS.</p>
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-2">Receipt</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2 text-right">Amount due</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-mono text-xs text-slate-800">{s.receiptNumber}</td>
                    <td className="px-3 py-2 text-xs text-slate-700">
                      {new Date(s.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-900">{money(s.amountDue)}</td>
                  </tr>
                ))}
                {sales.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-sm text-slate-600" colSpan={3}>
                      No sales recorded yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-900">Settlement entries (AR ledger)</h3>
            <p className="mt-1 text-xs text-slate-600">Invoices are posted automatically from stall sales and shortages.</p>
            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Ref</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {debtorSummary.entries.map((e) => (
                    <tr key={e.id} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-xs text-slate-700">{e.reference}</td>
                      <td className="px-3 py-2 text-xs text-slate-700">
                        {new Date(e.createdAt).toLocaleString(undefined, { dateStyle: "medium" })}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-slate-900">{money(e.amount)}</td>
                    </tr>
                  ))}
                  {debtorSummary.entries.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3 text-sm text-slate-600" colSpan={3}>
                        No AR entries yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

