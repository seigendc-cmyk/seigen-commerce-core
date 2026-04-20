"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardTopBar } from "@/components/dashboard/dashboard-top-bar";
import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";
import { listProductReadModels } from "@/modules/inventory/services/product-read-model";
import {
  CONSIGNMENT_UPDATED_EVENT,
  createConsignmentAgreement,
  listConsignmentAgreements,
} from "@/modules/consignment/services/consignment-agreements";
import { issueConsignmentStock } from "@/modules/consignment/services/consignment-operations";

function money(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function ConsignmentPage() {
  const [tick, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);

  useEffect(() => {
    const onAny = () => bump();
    window.addEventListener(CONSIGNMENT_UPDATED_EVENT, onAny);
    window.addEventListener("storage", onAny);
    return () => {
      window.removeEventListener(CONSIGNMENT_UPDATED_EVENT, onAny);
      window.removeEventListener("storage", onAny);
    };
  }, []);

  const agreements = useMemo(() => {
    void tick;
    return listConsignmentAgreements();
  }, [tick]);

  const branches = useMemo(() => InventoryRepo.listBranches(), []);

  const [newAgentName, setNewAgentName] = useState("");
  const [newPrincipalBranchId, setNewPrincipalBranchId] = useState(() => InventoryRepo.getDefaultBranch().id);
  const [newPremium, setNewPremium] = useState("20");
  const [status, setStatus] = useState<string | null>(null);

  const [issueAgreementId, setIssueAgreementId] = useState<string>("");
  const [issueProductId, setIssueProductId] = useState<string>("");
  const [issueQty, setIssueQty] = useState("1");
  const [issueCost, setIssueCost] = useState("");

  const catalog = useMemo(() => listProductReadModels(InventoryRepo.getDefaultBranch().id), [tick]);

  function createAgreement() {
    setStatus(null);
    const prem = Number(newPremium);
    const ag = createConsignmentAgreement({
      principalBranchId: newPrincipalBranchId,
      agentName: newAgentName,
      premiumPercent: Number.isFinite(prem) ? prem : 0,
    });
    setIssueAgreementId(ag.id);
    setNewAgentName("");
    setStatus(`Created agreement for ${ag.agentName}. Stall branch created.`);
    window.setTimeout(() => setStatus(null), 5000);
    bump();
  }

  function issueStock() {
    setStatus(null);
    const r = issueConsignmentStock({
      agreementId: issueAgreementId,
      productId: issueProductId,
      qty: Number(issueQty),
      invoiceUnitCost: Number(issueCost),
      ref: "Issue",
    });
    if (!r.ok) {
      setStatus(r.error);
      return;
    }
    setStatus("Issued to agent stall.");
    window.setTimeout(() => setStatus(null), 4000);
    bump();
  }

  return (
    <>
      <DashboardTopBar
        title="Consignment"
        subtitle="Agents operate as stall branches inside the vendor database. Stock issues are valued at invoice cost; agents sell with a premium and settle as debtors."
      />
      <div className="flex-1 space-y-6 px-4 py-6 sm:px-6">
        {status ? <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-neutral-200">{status}</div> : null}

        <section className="vendor-panel-soft rounded-2xl p-6">
          <h2 className="text-base font-semibold text-white">Create agent agreement</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="block text-xs text-neutral-400">
              <span className="mb-1 block font-medium text-neutral-300">Principal branch</span>
              <select
                className="vendor-field w-full rounded-lg px-3 py-2 text-sm text-white"
                value={newPrincipalBranchId}
                onChange={(e) => setNewPrincipalBranchId(e.target.value)}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-neutral-400">
              <span className="mb-1 block font-medium text-neutral-300">Agent name</span>
              <input
                className="vendor-field w-full rounded-lg px-3 py-2 text-sm text-white"
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
                placeholder="e.g. Stall A — Mary"
              />
            </label>
            <label className="block text-xs text-neutral-400">
              <span className="mb-1 block font-medium text-neutral-300">Premium %</span>
              <input
                className="vendor-field w-full rounded-lg px-3 py-2 text-sm text-white"
                value={newPremium}
                onChange={(e) => setNewPremium(e.target.value)}
                placeholder="e.g. 20"
              />
            </label>
          </div>
          <button
            type="button"
            className="mt-4 rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-white hover:bg-brand-orange-hover"
            onClick={createAgreement}
          >
            Create agreement
          </button>
        </section>

        <section className="vendor-panel-soft rounded-2xl p-6">
          <h2 className="text-base font-semibold text-white">Issue stock to agent (invoice cost)</h2>
          <p className="mt-2 text-sm text-neutral-400">
            Issuing moves on-hand from principal branch to the stall branch and records invoice unit cost. POS at the stall will sell at invoice cost + premium.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <label className="block text-xs text-neutral-400 sm:col-span-2">
              <span className="mb-1 block font-medium text-neutral-300">Agreement</span>
              <select
                className="vendor-field w-full rounded-lg px-3 py-2 text-sm text-white"
                value={issueAgreementId}
                onChange={(e) => setIssueAgreementId(e.target.value)}
              >
                <option value="">Select…</option>
                {agreements.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.agentName} · Stall {a.stallBranchId.slice(-6)} · Premium {a.premiumPercent}%
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-neutral-400 sm:col-span-2">
              <span className="mb-1 block font-medium text-neutral-300">Product</span>
              <select
                className="vendor-field w-full rounded-lg px-3 py-2 text-sm text-white"
                value={issueProductId}
                onChange={(e) => setIssueProductId(e.target.value)}
              >
                <option value="">Select…</option>
                {catalog.slice(0, 300).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} · {p.name} · on hand {p.onHandQty} · sell {money(p.sellingPrice)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-neutral-400">
              <span className="mb-1 block font-medium text-neutral-300">Qty</span>
              <input
                className="vendor-field w-full rounded-lg px-3 py-2 text-sm text-white"
                value={issueQty}
                onChange={(e) => setIssueQty(e.target.value)}
              />
            </label>
            <label className="block text-xs text-neutral-400">
              <span className="mb-1 block font-medium text-neutral-300">Invoice unit cost</span>
              <input
                className="vendor-field w-full rounded-lg px-3 py-2 text-sm text-white"
                value={issueCost}
                onChange={(e) => setIssueCost(e.target.value)}
                placeholder="e.g. 15.00"
              />
            </label>
          </div>
          <button
            type="button"
            className="mt-4 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-40"
            disabled={!issueAgreementId || !issueProductId}
            onClick={issueStock}
          >
            Issue stock
          </button>
        </section>

        <section className="vendor-panel-soft rounded-2xl p-6">
          <h2 className="text-base font-semibold text-white">Agreements</h2>
          {agreements.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-500">No consignment agents yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-white/10 bg-white/[0.04] text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  <tr>
                    <th className="px-3 py-2">Agent</th>
                    <th className="px-3 py-2">Principal</th>
                    <th className="px-3 py-2">Stall branch</th>
                    <th className="px-3 py-2 text-right">Premium</th>
                    <th className="px-3 py-2">Switch POS branch</th>
                  </tr>
                </thead>
                <tbody>
                  {agreements.map((a) => (
                    <tr key={a.id} className="border-b border-white/[0.06] last:border-0">
                      <td className="px-3 py-2 text-neutral-200">{a.agentName}</td>
                      <td className="px-3 py-2 text-neutral-400">{InventoryRepo.getBranch(a.principalBranchId)?.name ?? a.principalBranchId}</td>
                      <td className="px-3 py-2 text-neutral-400">{InventoryRepo.getBranch(a.stallBranchId)?.name ?? a.stallBranchId}</td>
                      <td className="px-3 py-2 text-right font-mono text-neutral-200">{a.premiumPercent.toFixed(2)}%</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15"
                          onClick={() => {
                            InventoryRepo.setDefaultBranch(a.stallBranchId);
                            setStatus(`Default branch set to ${InventoryRepo.getBranch(a.stallBranchId)?.name ?? "stall"}. Open POS to sell as agent.`);
                            window.setTimeout(() => setStatus(null), 6000);
                          }}
                        >
                          Use stall
                        </button>
                        <button
                          type="button"
                          className="ml-2 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                          onClick={() => {
                            InventoryRepo.setDefaultBranch(a.principalBranchId);
                            setStatus(`Default branch set to principal branch.`);
                            window.setTimeout(() => setStatus(null), 4000);
                          }}
                        >
                          Use principal
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

