"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardTopBar } from "@/components/dashboard/dashboard-top-bar";
import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";
import {
  CONSIGNMENT_UPDATED_EVENT,
  listConsignmentAgreements,
  deleteConsignmentAgentStall,
} from "@/modules/consignment/services/consignment-agreements";
import Link from "next/link";
import { ConsignmentAgreementModal } from "@/modules/consignment/ui/consignment-agreement-modal";
import { ConsignmentAgreementViewerModal } from "@/modules/consignment/ui/consignment-agreement-viewer-modal";
import { ConsignmentApprovalsPanel } from "@/modules/consignment/ui/consignment-approvals-panel";
import { ConsignmentAgentDeskPanel } from "@/modules/consignment/ui/consignment-agent-desk";

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
  const [openAgreementForm, setOpenAgreementForm] = useState(false);
  const [viewDocumentId, setViewDocumentId] = useState<string | null>(null);

  function createAgreement() {
    setOpenAgreementForm(true);
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
            className="mt-4 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
            onClick={createAgreement}
          >
            Create agreement
          </button>
        </section>

        <ConsignmentApprovalsPanel
          onViewContract={(documentId) => {
            setViewDocumentId(documentId);
          }}
        />

        <ConsignmentAgentDeskPanel />

        <section className="vendor-panel-soft rounded-2xl p-6">
          <h2 className="text-base font-semibold text-white">Consignment issue invoices</h2>
          <p className="mt-2 max-w-3xl text-sm text-neutral-400">
            Keep it simple: <strong className="text-neutral-200">Invoice → Approval → Stock transfer</strong>.
            <span className="ml-1">
              The agent stall only gets <strong className="text-neutral-200">sellable</strong> stock after approval.
            </span>
          </p>
          <div className="mt-4 grid gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-neutral-300 sm:grid-cols-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">1) Invoice</div>
              <div className="mt-1 text-neutral-200">Create the issue invoice lines and values.</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">2) Approval</div>
              <div className="mt-1 text-neutral-200">Supervisor/manager verifies the document.</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">3) Stock transfer</div>
              <div className="mt-1 text-neutral-200">On approval, stock becomes sellable at the stall.</div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/dashboard/consignment/issue-invoices/new"
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
            >
              Create invoice
            </Link>
            <Link
              href="/dashboard/consignment/issue-invoices"
              className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              Track invoices
            </Link>
            <Link
              href="/dashboard/consignment/issue-invoices/queue"
              className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/20"
            >
              Approve & release stock
            </Link>
          </div>
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
                    <th className="px-3 py-2">Contract</th>
                    <th className="px-3 py-2">Switch POS branch</th>
                    <th className="px-3 py-2 text-right">Manage</th>
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
                        {a.documentId ? (
                          <button
                            type="button"
                            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                            onClick={() => setViewDocumentId(a.documentId ?? null)}
                          >
                            View / Print
                          </button>
                        ) : (
                          <span className="text-xs text-neutral-500">—</span>
                        )}
                      </td>
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
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
                          onClick={() => {
                            const cur = InventoryRepo.getBranch(a.stallBranchId)?.name ?? "";
                            const next = window.prompt("Rename stall branch:", cur);
                            if (!next) return;
                            InventoryRepo.updateBranch(a.stallBranchId, { name: next });
                            setStatus(`Stall renamed to "${next}".`);
                            window.setTimeout(() => setStatus(null), 4000);
                            bump();
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="ml-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-500/15"
                          onClick={() => {
                            if (!window.confirm(`Delete stall for "${a.agentName}"? This removes the stall branch if it has no stock.`)) return;
                            const r = deleteConsignmentAgentStall({ agreementId: a.id });
                            if (!r.ok) {
                              setStatus(r.error);
                              window.setTimeout(() => setStatus(null), 6000);
                              return;
                            }
                            setStatus("Stall deleted.");
                            window.setTimeout(() => setStatus(null), 4000);
                            bump();
                          }}
                        >
                          Delete
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
      <ConsignmentAgreementModal
        open={openAgreementForm}
        principalBranchId={newPrincipalBranchId}
        premiumPercentDefault={Number(newPremium) || 0}
        agentNameDefault={newAgentName}
        onClose={() => setOpenAgreementForm(false)}
        onSubmitted={(requestId) => {
          setOpenAgreementForm(false);
          setNewAgentName("");
          setStatus(`Agreement submitted for approval (Request ${requestId.slice(-8)}). No stall is created until approved.`);
          window.setTimeout(() => setStatus(null), 8000);
          bump();
        }}
      />
      <ConsignmentAgreementViewerModal open={viewDocumentId != null} documentId={viewDocumentId} onClose={() => setViewDocumentId(null)} />
    </>
  );
}

