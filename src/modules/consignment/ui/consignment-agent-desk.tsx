"use client";

import { useEffect, useMemo, useState } from "react";
import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";
import { listProductReadModels } from "@/modules/inventory/services/product-read-model";
import { listSales } from "@/modules/pos/services/sales-service";
import { listDebtorEntriesForCustomer, balanceByCustomerId } from "@/modules/financial/services/debtors-ledger";
import { listConsignmentAgentProvisioning, CONSIGNMENT_AGENT_PROVISIONING_UPDATED } from "@/modules/consignment/services/consignment-agent-provisioning";
import { CONSIGNMENT_UPDATED_EVENT, getConsignmentAgreement } from "@/modules/consignment/services/consignment-agreements";
import { listConsignmentCustodyEntries } from "@/modules/consignment/services/consignment-custody-ledger";
import {
  CONSIGNMENT_AGENT_ACCESS_CODES_UPDATED,
  getActiveAgentAccessCodeForProvisioning,
} from "@/modules/consignment/services/consignment-agent-access-codes";
import { deactivateConsignmentAgent } from "@/modules/consignment/services/consignment-agent-admin";

function money(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

type AgentSubTab = "dashboard" | "stall" | "activities";

function SegTabs({
  tab,
  setTab,
}: {
  tab: AgentSubTab;
  setTab: (t: AgentSubTab) => void;
}) {
  const tabs: Array<[AgentSubTab, string]> = [
    ["dashboard", "Dashboard"],
    ["stall", "Stall"],
    ["activities", "Activities & reports"],
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => setTab(id)}
          className={tab === id ? "vendor-seg-tab vendor-seg-tab-active" : "vendor-seg-tab vendor-seg-tab-inactive"}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function ConsignmentAgentDeskPanel() {
  const [tick, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);

  useEffect(() => {
    const onAny = () => bump();
    window.addEventListener("storage", onAny);
    window.addEventListener(CONSIGNMENT_UPDATED_EVENT, onAny);
    window.addEventListener(CONSIGNMENT_AGENT_PROVISIONING_UPDATED, onAny);
    window.addEventListener(CONSIGNMENT_AGENT_ACCESS_CODES_UPDATED, onAny);
    window.addEventListener("seigen-pos-sale-recorded", onAny as any);
    window.addEventListener("seigen-financial-ledgers-updated", onAny as any);
    return () => {
      window.removeEventListener("storage", onAny);
      window.removeEventListener(CONSIGNMENT_UPDATED_EVENT, onAny);
      window.removeEventListener(CONSIGNMENT_AGENT_PROVISIONING_UPDATED, onAny);
      window.removeEventListener(CONSIGNMENT_AGENT_ACCESS_CODES_UPDATED, onAny);
      window.removeEventListener("seigen-pos-sale-recorded", onAny as any);
      window.removeEventListener("seigen-financial-ledgers-updated", onAny as any);
    };
  }, []);

  const provisionings = useMemo(() => {
    void tick;
    return listConsignmentAgentProvisioning();
  }, [tick]);

  const [activeProvisioningId, setActiveProvisioningId] = useState<string>("");
  const [subTab, setSubTab] = useState<AgentSubTab>("dashboard");
  const [copied, setCopied] = useState(false);
  const [showDeactivated, setShowDeactivated] = useState(false);
  const [adminStatus, setAdminStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!activeProvisioningId && provisionings.length > 0) {
      setActiveProvisioningId(provisionings[0]!.id);
    }
  }, [activeProvisioningId, provisionings]);

  const visibleProvisionings = useMemo(
    () => provisionings.filter((p) => (showDeactivated ? true : p.status !== "disabled")),
    [provisionings, showDeactivated],
  );

  const active = useMemo(
    () => visibleProvisionings.find((p) => p.id === activeProvisioningId) ?? null,
    [visibleProvisionings, activeProvisioningId],
  );
  const agreement = useMemo(() => {
    void tick;
    if (!active) return null;
    return getConsignmentAgreement(active.agreementId) ?? null;
  }, [active, tick]);

  const stall = useMemo(() => (active ? InventoryRepo.getBranch(active.stallBranchId) : null), [active]);
  const principal = useMemo(() => (active ? InventoryRepo.getBranch(active.principalBranchId) : null), [active]);

  const activeCode = useMemo(() => {
    void tick;
    if (!active) return null;
    return getActiveAgentAccessCodeForProvisioning(active.id) ?? null;
  }, [active, tick]);

  const stock = useMemo(() => {
    void tick;
    if (!active) return [];
    return listProductReadModels(active.stallBranchId).slice().sort((a, b) => a.name.localeCompare(b.name));
  }, [active, tick]);

  const sales = useMemo(() => {
    void tick;
    if (!active) return [];
    return listSales().filter((s) => s.branchId === active.stallBranchId).slice(0, 80);
  }, [active, tick]);

  const debtorSummary = useMemo(() => {
    void tick;
    const agentId = agreement?.agentId;
    if (!agentId) return { balance: 0, entries: [] as ReturnType<typeof listDebtorEntriesForCustomer> };
    const balance = balanceByCustomerId().get(agentId) ?? 0;
    const entries = listDebtorEntriesForCustomer(agentId).slice(0, 30);
    return { balance, entries };
  }, [agreement?.agentId, tick]);

  const custody = useMemo(() => {
    void tick;
    if (!active) return [];
    return listConsignmentCustodyEntries(active.agreementId, 250);
  }, [active, tick]);

  const salesTotals = useMemo(() => {
    const total = sales.reduce((acc, s) => acc + (Number(s.amountDue) || 0), 0);
    return { count: sales.length, total };
  }, [sales]);

  if (visibleProvisionings.length === 0) return null;

  return (
    <section className="vendor-panel-soft rounded-2xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">Agents</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Dedicated agent tabs are created automatically when an agreement is approved (stall provisioned). Each tab shows the agent dashboard, stall surface, and governed activity reports.
          </p>
          {adminStatus ? (
            <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-neutral-200">
              {adminStatus}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex items-center gap-2 text-xs text-neutral-300">
            <input
              type="checkbox"
              checked={showDeactivated}
              onChange={(e) => setShowDeactivated(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-600 bg-neutral-800 text-teal-600 focus:ring-teal-500"
            />
            Show deactivated
          </label>

          <label className="block text-xs text-neutral-400">
          <span className="mb-1 block font-medium text-neutral-300">Agent</span>
          <select
            className="vendor-field w-[min(420px,90vw)] rounded-lg px-3 py-2 text-sm text-white"
            value={activeProvisioningId}
            onChange={(e) => {
              setActiveProvisioningId(e.target.value);
              setSubTab("dashboard");
              setCopied(false);
              setAdminStatus(null);
            }}
          >
            {visibleProvisionings.map((p) => (
              <option key={p.id} value={p.id}>
                {p.agentName} · {p.agentEmail} · {p.status}
              </option>
            ))}
          </select>
        </label>
        </div>
      </div>

      {!active ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-neutral-200">
          Select an agent to view details.
        </div>
      ) : (
        <>
          <div className="mt-4">
            <SegTabs tab={subTab} setTab={setSubTab} />
          </div>

          {subTab === "dashboard" ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 lg:col-span-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Agent</div>
                    <div className="mt-1 text-lg font-semibold text-white">
                      {active.agentName} · <span className="text-neutral-300">{active.agentEmail}</span>
                    </div>
                    <div className="mt-2 text-sm text-neutral-300">
                      Principal: <span className="font-semibold text-white">{principal?.name ?? active.principalBranchId}</span>
                    </div>
                    <div className="mt-1 text-sm text-neutral-300">
                      Stall: <span className="font-semibold text-white">{stall?.name ?? active.stallBranchId}</span>
                    </div>
                    <div className="mt-1 text-xs text-neutral-500">
                      Provisioning: <span className="font-mono">{active.id.slice(-8)}</span> · Agreement:{" "}
                      <span className="font-mono">{active.agreementId.slice(-8)}</span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                    <div className="text-xs font-semibold text-neutral-300">Outstanding settlement (AR)</div>
                    <div className="mt-1 text-xl font-mono font-semibold text-white">{money(debtorSummary.balance)}</div>
                    <div className="mt-1 text-xs text-neutral-500">From debtor ledger entries (sales + shortages).</div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <div className="text-xs font-semibold text-neutral-400">Link status</div>
                    <div className="mt-1 text-sm font-semibold text-white">{active.status === "linked" ? "Linked" : "Pending link"}</div>
                    <div className="mt-1 text-xs text-neutral-500">
                      {active.agentUserId ? `userId ${active.agentUserId.slice(-8)}` : "No Supabase user linked yet."}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <div className="text-xs font-semibold text-neutral-400">Stock lines</div>
                    <div className="mt-1 text-sm font-semibold text-white">{stock.length}</div>
                    <div className="mt-1 text-xs text-neutral-500">Live from stall branch inventory.</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <div className="text-xs font-semibold text-neutral-400">Recent sales</div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {salesTotals.count} · {money(salesTotals.total)}
                    </div>
                    <div className="mt-1 text-xs text-neutral-500">Last {salesTotals.count} receipts (stall).</div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <div className="text-sm font-semibold text-white">Agent access</div>
                <p className="mt-1 text-xs text-neutral-500">
                  Agent signs in and (if required) redeems a one-time access code to link their account to this stall.
                </p>

                {activeCode && active.status !== "linked" ? (
                  <div className="mt-4">
                    <div className="text-xs font-semibold text-neutral-400">Active one-time code</div>
                    <div className="mt-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 font-mono text-base text-white">
                      {activeCode.code}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(activeCode.code);
                            setCopied(true);
                            window.setTimeout(() => setCopied(false), 2000);
                          } catch {
                            // keep visible
                          }
                        }}
                      >
                        Copy
                      </button>
                      <div className="text-[11px] text-neutral-500 self-center">codeId {activeCode.id.slice(-8)}</div>
                    </div>
                    {copied ? (
                      <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200">
                        Copied to clipboard.
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-neutral-200">
                    {active.status === "linked" ? "Agent is already linked." : "No active code found for this provisioning."}
                  </div>
                )}

                <div className="mt-5 rounded-xl border border-rose-500/25 bg-rose-500/5 p-4">
                  <div className="text-sm font-semibold text-rose-100">Deactivate agent</div>
                  <p className="mt-1 text-xs text-neutral-300">
                    Deactivation blocks agent access (disables provisioning and any active access codes) while keeping history and ledgers intact.
                  </p>
                  <button
                    type="button"
                    disabled={active.status === "disabled"}
                    className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-500/15 disabled:opacity-40"
                    onClick={() => {
                      const reason = window.prompt("Reason for deactivation (optional):") ?? "";
                      if (!window.confirm(`Deactivate agent “${active.agentName}” for this stall?`)) return;
                      const res = deactivateConsignmentAgent({
                        provisioningId: active.id,
                        agreementId: active.agreementId,
                        reason,
                      });
                      if (!res.ok) {
                        setAdminStatus(res.error);
                        return;
                      }
                      setAdminStatus(`Deactivated. Disabled ${res.disabledCodes} active access code(s).`);
                      window.setTimeout(() => setAdminStatus(null), 6000);
                      bump();
                    }}
                  >
                    Deactivate
                  </button>
                  {active.status === "disabled" ? (
                    <div className="mt-2 text-xs text-neutral-300">This agent stall is currently deactivated.</div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {subTab === "stall" ? (
            <div className="mt-5 grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
                <h3 className="text-sm font-semibold text-white">Stall details</h3>
                <div className="mt-3 space-y-1 text-sm text-neutral-300">
                  <div>
                    <span className="text-neutral-500">Name:</span> <span className="font-semibold text-white">{stall?.name ?? "—"}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500">Branch id:</span> <span className="font-mono text-neutral-200">{active.stallBranchId}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500">Agreement premium:</span>{" "}
                    <span className="font-mono text-neutral-200">{agreement?.premiumPercent?.toFixed(2) ?? "—"}%</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
                <h3 className="text-sm font-semibold text-white">Stock list (stall)</h3>
                <p className="mt-1 text-xs text-neutral-500">Live stock visibility for this agent stall branch.</p>
                <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead className="border-b border-white/10 bg-white/[0.04] text-xs font-semibold uppercase tracking-wide text-neutral-400">
                      <tr>
                        <th className="px-3 py-2">SKU</th>
                        <th className="px-3 py-2">Product</th>
                        <th className="px-3 py-2 text-right">On hand</th>
                        <th className="px-3 py-2 text-right">Sell</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stock.slice(0, 160).map((p) => (
                        <tr key={p.id} className="border-b border-white/[0.06] last:border-0">
                          <td className="px-3 py-2 font-mono text-xs text-neutral-300">{p.sku}</td>
                          <td className="px-3 py-2 text-neutral-100">{p.name}</td>
                          <td className="px-3 py-2 text-right font-mono text-neutral-100">{p.onHandQty}</td>
                          <td className="px-3 py-2 text-right font-mono text-neutral-100">{money(p.sellingPrice)}</td>
                        </tr>
                      ))}
                      {stock.length === 0 ? (
                        <tr>
                          <td className="px-3 py-3 text-sm text-neutral-400" colSpan={4}>
                            No stock found for this stall yet.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}

          {subTab === "activities" ? (
            <div className="mt-5 space-y-6">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
                <h3 className="text-sm font-semibold text-white">Consignment custody ledger (governed)</h3>
                <p className="mt-1 text-xs text-neutral-500">
                  Immutable custody trail of stock issues/returns/sales/losses for this agreement.
                </p>
                <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full min-w-[980px] text-left text-sm">
                    <thead className="border-b border-white/10 bg-white/[0.04] text-xs font-semibold uppercase tracking-wide text-neutral-400">
                      <tr>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Kind</th>
                        <th className="px-3 py-2">Product</th>
                        <th className="px-3 py-2 text-right">Qty Δ</th>
                        <th className="px-3 py-2 text-right">Invoice unit cost</th>
                        <th className="px-3 py-2">Ref</th>
                      </tr>
                    </thead>
                    <tbody>
                      {custody.map((e) => (
                        <tr key={e.id} className="border-b border-white/[0.06] last:border-0">
                          <td className="px-3 py-2 text-xs text-neutral-300">
                            {new Date(e.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-neutral-200">{e.kind}</td>
                          <td className="px-3 py-2 font-mono text-xs text-neutral-300">{e.productId}</td>
                          <td className="px-3 py-2 text-right font-mono text-neutral-100">{e.qtyDelta}</td>
                          <td className="px-3 py-2 text-right font-mono text-neutral-100">{money(e.invoiceUnitCost)}</td>
                          <td className="px-3 py-2 text-xs text-neutral-300">{e.ref ?? "—"}</td>
                        </tr>
                      ))}
                      {custody.length === 0 ? (
                        <tr>
                          <td className="px-3 py-3 text-sm text-neutral-400" colSpan={6}>
                            No custody entries yet.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
                  <h3 className="text-sm font-semibold text-white">Recent sales (stall)</h3>
                  <p className="mt-1 text-xs text-neutral-500">Latest receipts recorded from this stall POS.</p>
                  <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
                    <table className="w-full min-w-[520px] text-left text-sm">
                      <thead className="border-b border-white/10 bg-white/[0.04] text-xs font-semibold uppercase tracking-wide text-neutral-400">
                        <tr>
                          <th className="px-3 py-2">Receipt</th>
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2 text-right">Amount due</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sales.map((s) => (
                          <tr key={s.id} className="border-b border-white/[0.06] last:border-0">
                            <td className="px-3 py-2 font-mono text-xs text-neutral-100">{s.receiptNumber}</td>
                            <td className="px-3 py-2 text-xs text-neutral-300">
                              {new Date(s.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-neutral-100">{money(s.amountDue)}</td>
                          </tr>
                        ))}
                        {sales.length === 0 ? (
                          <tr>
                            <td className="px-3 py-3 text-sm text-neutral-400" colSpan={3}>
                              No sales recorded yet.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
                  <h3 className="text-sm font-semibold text-white">Settlement entries (AR ledger)</h3>
                  <p className="mt-1 text-xs text-neutral-500">
                    Agent is treated as a debtor. Entries come from sales and shortages under this agreement.
                  </p>
                  <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
                    <table className="w-full min-w-[520px] text-left text-sm">
                      <thead className="border-b border-white/10 bg-white/[0.04] text-xs font-semibold uppercase tracking-wide text-neutral-400">
                        <tr>
                          <th className="px-3 py-2">Ref</th>
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {debtorSummary.entries.map((e) => (
                          <tr key={e.id} className="border-b border-white/[0.06] last:border-0">
                            <td className="px-3 py-2 text-xs text-neutral-300">{e.reference}</td>
                            <td className="px-3 py-2 text-xs text-neutral-300">
                              {new Date(e.createdAt).toLocaleString(undefined, { dateStyle: "medium" })}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-neutral-100">{money(e.amount)}</td>
                          </tr>
                        ))}
                        {debtorSummary.entries.length === 0 ? (
                          <tr>
                            <td className="px-3 py-3 text-sm text-neutral-400" colSpan={3}>
                              No AR entries yet.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

