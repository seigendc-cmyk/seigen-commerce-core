"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardTopBar } from "@/components/dashboard/dashboard-top-bar";
import { buildPoolWiseSignals } from "@/modules/poolwise/services/poolwise-signals";
import {
  POOLWISE_UPDATED_EVENT,
  createDisposalListing,
  createPool,
  createSupplierOffer,
  joinPool,
  listDisposalListings,
  listPoolMembers,
  listPools,
  listSupplierOffers,
  recordContribution,
  setMemberStatus,
  upsertPoolWiseTenant,
  listPoolWiseTenants,
  type PoolType,
} from "@/modules/poolwise/services/poolwise-store";
import { suggestAllocations } from "@/modules/poolwise/services/poolwise-allocation";

function money(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

type Tab = "signals" | "pools" | "market" | "contributions" | "allocation";

function SegTabs({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const tabs: Array<[Tab, string]> = [
    ["signals", "Signals"],
    ["pools", "Pools"],
    ["market", "Market Space"],
    ["contributions", "Contributions"],
    ["allocation", "Allocation"],
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

export function PoolWisePage() {
  const [tab, setTab] = useState<Tab>("signals");
  const [tick, setTick] = useState(0);
  const bump = () => setTick((t) => t + 1);

  useEffect(() => {
    const onAny = () => bump();
    window.addEventListener(POOLWISE_UPDATED_EVENT, onAny);
    window.addEventListener("storage", onAny);
    return () => {
      window.removeEventListener(POOLWISE_UPDATED_EVENT, onAny);
      window.removeEventListener("storage", onAny);
    };
  }, []);

  const tenants = useMemo(() => {
    void tick;
    return listPoolWiseTenants();
  }, [tick]);

  const pools = useMemo(() => {
    void tick;
    return listPools();
  }, [tick]);

  const [activePoolId, setActivePoolId] = useState<string>("");
  const activePool = useMemo(() => pools.find((p) => p.id === activePoolId) ?? null, [pools, activePoolId]);

  useEffect(() => {
    if (!activePoolId && pools[0]) setActivePoolId(pools[0].id);
  }, [activePoolId, pools]);

  const members = useMemo(() => (activePool ? listPoolMembers(activePool.id) : []), [tick, activePool?.id]);
  const offers = useMemo(() => (activePool ? listSupplierOffers(activePool.id) : []), [tick, activePool?.id]);
  const disposals = useMemo(() => {
    void tick;
    return listDisposalListings().filter((d) => d.status === "active");
  }, [tick]);

  const signals = useMemo(() => {
    void tick;
    return buildPoolWiseSignals({ lookbackDays: 30, fastSellerUnitsPerDay: 1 });
  }, [tick]);

  // Tenant
  const [tenantId, setTenantId] = useState("tenant_main");
  const [tenantName, setTenantName] = useState("Main vendor");

  // Create pool
  const [poolType, setPoolType] = useState<PoolType>("stock_refill");
  const [poolTitle, setPoolTitle] = useState("Stock refill pool");
  const [poolQuery, setPoolQuery] = useState("");
  const [poolTarget, setPoolTarget] = useState("0");

  // Join pool
  const [joinTenantId, setJoinTenantId] = useState("");
  const [joinTenantName, setJoinTenantName] = useState("");

  // Disposal listing
  const [listingLabel, setListingLabel] = useState("");
  const [listingQty, setListingQty] = useState("10");
  const [listingUnitPrice, setListingUnitPrice] = useState("0");

  // Supplier offer with price breaks
  const [offerSupplierId, setOfferSupplierId] = useState("");
  const [offerSupplierName, setOfferSupplierName] = useState("");
  const [offerProductLabel, setOfferProductLabel] = useState("");
  const [offerMoq, setOfferMoq] = useState("10");
  const [offerLead, setOfferLead] = useState("7");
  const [offerBreaks, setOfferBreaks] = useState("10:5.00,50:4.50,100:4.10");

  // Contributions
  const [contribTenantId, setContribTenantId] = useState("");
  const [contribTenantName, setContribTenantName] = useState("");
  const [contribAmount, setContribAmount] = useState("0");

  // Allocation
  const [allocOfferId, setAllocOfferId] = useState("");
  const [allocQty, setAllocQty] = useState("100");
  const allocOffer = useMemo(() => offers.find((o) => o.id === allocOfferId) ?? null, [offers, allocOfferId]);
  const suggestions = useMemo(() => {
    if (!activePool || !allocOffer) return [];
    return suggestAllocations({ pool: activePool, members, offer: allocOffer, totalQty: Number(allocQty) });
  }, [activePool, allocOffer, members, allocQty]);

  function ensureTenant() {
    upsertPoolWiseTenant({ tenantId: tenantId.trim(), name: tenantName.trim() });
  }

  function parseBreaks(s: string) {
    return s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => {
        const [a, b] = x.split(":").map((t) => t.trim());
        return { minQty: Number(a), unitPrice: Number(b) };
      })
      .filter((x) => Number.isFinite(x.minQty) && Number.isFinite(x.unitPrice));
  }

  return (
    <>
      <DashboardTopBar
        title="PoolWise"
        subtitle="Collaborative pools + market space + contribution control + allocations — integrated as an overlay (no changes to POS/Inventory business logic)."
      />
      <div className="flex-1 space-y-6 px-4 py-6 sm:px-6">
        <SegTabs tab={tab} setTab={setTab} />

        <section className="vendor-panel-soft rounded-2xl p-6">
          <h2 className="text-base font-semibold text-white">Tenant identity (local-first)</h2>
          <p className="mt-2 max-w-3xl text-sm text-neutral-400">
            Participants are vendor tenants. For now we model tenants as identities stored locally; later this maps to real tenants (Supabase).
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="block text-xs text-neutral-400">
              <span className="mb-1 block font-medium text-neutral-300">Tenant id</span>
              <input className="vendor-field w-full rounded-lg px-3 py-2 text-sm text-white" value={tenantId} onChange={(e) => setTenantId(e.target.value)} />
            </label>
            <label className="block text-xs text-neutral-400 sm:col-span-2">
              <span className="mb-1 block font-medium text-neutral-300">Tenant name</span>
              <input className="vendor-field w-full rounded-lg px-3 py-2 text-sm text-white" value={tenantName} onChange={(e) => setTenantName(e.target.value)} />
            </label>
          </div>
          <button type="button" className="mt-4 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15" onClick={ensureTenant}>
            Save tenant
          </button>
          {tenants.length ? (
            <p className="mt-3 text-xs text-neutral-500">Known tenants: {tenants.map((t) => t.name).join(", ")}</p>
          ) : null}
        </section>

        {tab === "signals" ? (
          <section className="vendor-panel-soft rounded-2xl p-6">
            <h2 className="text-base font-semibold text-white">Signals (read-only)</h2>
            <p className="mt-2 max-w-3xl text-sm text-neutral-400">
              PoolWise reads Inventory + POS to suggest what to buy together or dispose. No operational data is changed here.
            </p>
            <div className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-neutral-950/80">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b border-white/10 bg-neutral-950 text-xs font-semibold uppercase tracking-wide text-neutral-300">
                  <tr>
                    <th className="px-3 py-2">Kind</th>
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2 text-right">On hand</th>
                    <th className="px-3 py-2 text-right">Sold (30d)</th>
                    <th className="px-3 py-2 text-right">/day</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {signals.map((s) => (
                    <tr key={s.id}>
                      <td className="px-3 py-2 text-neutral-200">{s.kind.replace(/_/g, " ")}</td>
                      <td className="px-3 py-2 font-mono text-neutral-200">{s.sku}</td>
                      <td className="px-3 py-2 text-neutral-200">{s.name}</td>
                      <td className="px-3 py-2 text-right font-mono text-neutral-200">{s.onHand}</td>
                      <td className="px-3 py-2 text-right font-mono text-neutral-200">{s.unitsSold}</td>
                      <td className="px-3 py-2 text-right font-mono text-neutral-200">{s.unitsPerDay}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {tab === "pools" ? (
          <section className="vendor-panel-soft rounded-2xl p-6">
            <h2 className="text-base font-semibold text-white">Pools</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <label className="block text-xs text-neutral-400">
                <span className="mb-1 block font-medium text-neutral-300">Type</span>
                <select className="vendor-field w-full rounded-lg px-3 py-2 text-sm text-white" value={poolType} onChange={(e) => setPoolType(e.target.value as PoolType)}>
                  <option value="bulk_purchase">Bulk purchase</option>
                  <option value="stock_refill">Stock refill</option>
                  <option value="disposal">Disposal</option>
                  <option value="supplier_listing">Supplier listing</option>
                </select>
              </label>
              <label className="block text-xs text-neutral-400 sm:col-span-2">
                <span className="mb-1 block font-medium text-neutral-300">Title</span>
                <input className="vendor-field w-full rounded-lg px-3 py-2 text-sm text-white" value={poolTitle} onChange={(e) => setPoolTitle(e.target.value)} />
              </label>
              <label className="block text-xs text-neutral-400">
                <span className="mb-1 block font-medium text-neutral-300">Target contribution (optional)</span>
                <input className="vendor-field w-full rounded-lg px-3 py-2 text-sm text-white" value={poolTarget} onChange={(e) => setPoolTarget(e.target.value)} />
              </label>
              <label className="block text-xs text-neutral-400 sm:col-span-4">
                <span className="mb-1 block font-medium text-neutral-300">Product / category</span>
                <input className="vendor-field w-full rounded-lg px-3 py-2 text-sm text-white" value={poolQuery} onChange={(e) => setPoolQuery(e.target.value)} placeholder="e.g. cooking oil 20L, cement, maize seed" />
              </label>
            </div>
            <button
              type="button"
              className="mt-4 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
              onClick={() => {
                ensureTenant();
                const p = createPool({
                  createdByTenantId: tenantId.trim(),
                  type: poolType,
                  title: poolTitle,
                  description: "",
                  productQuery: poolQuery,
                  currency: "USD",
                  targetContributionAmount: Number(poolTarget) > 0 ? Number(poolTarget) : null,
                  allowReducedContributions: true,
                  allowDropouts: true,
                  allocationMode: "by_contribution",
                });
                setActivePoolId(p.id);
              }}
            >
              Create pool
            </button>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Pool list</p>
                <div className="mt-3 space-y-2">
                  {pools.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setActivePoolId(p.id)}
                      className={[
                        "w-full rounded-lg border px-3 py-2 text-left text-sm",
                        activePoolId === p.id ? "border-teal-500/40 bg-teal-600/10 text-white" : "border-white/10 bg-black/20 text-neutral-200 hover:bg-white/5",
                      ].join(" ")}
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-semibold">{p.title}</span>
                        <span className="text-xs text-neutral-400">{p.status}</span>
                      </div>
                      <p className="mt-1 text-xs text-neutral-500">{p.type.replace(/_/g, " ")} · {p.productQuery || "—"}</p>
                    </button>
                  ))}
                  {pools.length === 0 ? <p className="text-sm text-neutral-500">No pools yet.</p> : null}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Members</p>
                {!activePool ? <p className="mt-2 text-sm text-neutral-500">Select a pool.</p> : (
                  <>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="block text-xs text-neutral-400">
                        <span className="mb-1 block font-medium text-neutral-300">Tenant id</span>
                        <input className="vendor-field w-full rounded-lg px-3 py-2 text-sm text-white" value={joinTenantId} onChange={(e) => setJoinTenantId(e.target.value)} />
                      </label>
                      <label className="block text-xs text-neutral-400">
                        <span className="mb-1 block font-medium text-neutral-300">Tenant name</span>
                        <input className="vendor-field w-full rounded-lg px-3 py-2 text-sm text-white" value={joinTenantName} onChange={(e) => setJoinTenantName(e.target.value)} />
                      </label>
                    </div>
                    <button
                      type="button"
                      className="mt-3 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
                      onClick={() => {
                        if (!joinTenantId.trim()) return;
                        upsertPoolWiseTenant({ tenantId: joinTenantId, name: joinTenantName || joinTenantId });
                        joinPool({
                          poolId: activePool.id,
                          tenantId: joinTenantId,
                          tenantName: joinTenantName || joinTenantId,
                          pledgedAmount: activePool.targetContributionAmount,
                        });
                        setJoinTenantId("");
                        setJoinTenantName("");
                      }}
                    >
                      Add member
                    </button>

                    <div className="mt-4 space-y-2">
                      {members.map((m) => (
                        <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-neutral-200">
                          <span>{m.tenantName}</span>
                          <div className="flex flex-wrap gap-2">
                            <span className="text-xs text-neutral-500">{m.status}</span>
                            <button type="button" className="rounded-md bg-white/10 px-2 py-1 text-xs font-semibold text-white hover:bg-white/15" onClick={() => setMemberStatus(activePool.id, m.tenantId, "reduced", "Reduced")}>
                              Reduce
                            </button>
                            <button type="button" className="rounded-md bg-rose-500/10 px-2 py-1 text-xs font-semibold text-rose-200 hover:bg-rose-500/15" onClick={() => setMemberStatus(activePool.id, m.tenantId, "dropped", "Dropped")}>
                              Dropout
                            </button>
                          </div>
                        </div>
                      ))}
                      {members.length === 0 ? <p className="text-sm text-neutral-500">No members yet.</p> : null}
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {tab === "market" ? (
          <section className="vendor-panel-soft rounded-2xl p-6">
            <h2 className="text-base font-semibold text-white">Market Space</h2>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Disposal listing (vendor → vendor)</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <label className="block text-xs text-neutral-400 sm:col-span-3">
                    <span className="mb-1 block font-medium text-neutral-300">Product label</span>
                    <input className="vendor-field w-full rounded-lg px-3 py-2 text-sm text-white" value={listingLabel} onChange={(e) => setListingLabel(e.target.value)} placeholder="e.g. Rice 25kg bags" />
                  </label>
                  <label className="block text-xs text-neutral-400">
                    <span className="mb-1 block font-medium text-neutral-300">Qty</span>
                    <input className="vendor-field w-full rounded-lg px-3 py-2 text-sm text-white" value={listingQty} onChange={(e) => setListingQty(e.target.value)} />
                  </label>
                  <label className="block text-xs text-neutral-400">
                    <span className="mb-1 block font-medium text-neutral-300">Unit price</span>
                    <input className="vendor-field w-full rounded-lg px-3 py-2 text-sm text-white" value={listingUnitPrice} onChange={(e) => setListingUnitPrice(e.target.value)} />
                  </label>
                  <div className="sm:col-span-1 flex items-end">
                    <button
                      type="button"
                      className="w-full rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
                      onClick={() => {
                        ensureTenant();
                        createDisposalListing({
                          sellerTenantId: tenantId.trim(),
                          sellerName: tenantName.trim(),
                          productLabel: listingLabel,
                          qtyAvailable: Number(listingQty),
                          unit: "unit",
                          unitPrice: Number(listingUnitPrice),
                          currency: "USD",
                          notes: "",
                        });
                        setListingLabel("");
                      }}
                    >
                      Publish
                    </button>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {disposals.slice(0, 8).map((d) => (
                    <div key={d.id} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-neutral-200">
                      <div className="flex justify-between gap-2">
                        <span className="font-semibold">{d.productLabel}</span>
                        <span className="font-mono text-neutral-200">{money(d.unitPrice)} {d.currency}</span>
                      </div>
                      <p className="mt-1 text-xs text-neutral-500">{d.sellerName} · qty {d.qtyAvailable}</p>
                    </div>
                  ))}
                  {disposals.length === 0 ? <p className="text-sm text-neutral-500">No active disposal listings.</p> : null}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Supplier offer (price breaks)</p>
                <p className="mt-2 text-xs text-neutral-500">Format breaks: `minQty:unitPrice, ...` e.g. `10:5.00,50:4.50,100:4.10`</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs text-neutral-400">
                    <span className="mb-1 block font-medium text-neutral-300">Supplier tenant id</span>
                    <input className="vendor-field w-full rounded-lg px-3 py-2 text-sm text-white" value={offerSupplierId} onChange={(e) => setOfferSupplierId(e.target.value)} />
                  </label>
                  <label className="block text-xs text-neutral-400">
                    <span className="mb-1 block font-medium text-neutral-300">Supplier name</span>
                    <input className="vendor-field w-full rounded-lg px-3 py-2 text-sm text-white" value={offerSupplierName} onChange={(e) => setOfferSupplierName(e.target.value)} />
                  </label>
                  <label className="block text-xs text-neutral-400 sm:col-span-2">
                    <span className="mb-1 block font-medium text-neutral-300">Product label</span>
                    <input className="vendor-field w-full rounded-lg px-3 py-2 text-sm text-white" value={offerProductLabel} onChange={(e) => setOfferProductLabel(e.target.value)} />
                  </label>
                  <label className="block text-xs text-neutral-400">
                    <span className="mb-1 block font-medium text-neutral-300">MOQ</span>
                    <input className="vendor-field w-full rounded-lg px-3 py-2 text-sm text-white" value={offerMoq} onChange={(e) => setOfferMoq(e.target.value)} />
                  </label>
                  <label className="block text-xs text-neutral-400">
                    <span className="mb-1 block font-medium text-neutral-300">Lead time (days)</span>
                    <input className="vendor-field w-full rounded-lg px-3 py-2 text-sm text-white" value={offerLead} onChange={(e) => setOfferLead(e.target.value)} />
                  </label>
                  <label className="block text-xs text-neutral-400 sm:col-span-2">
                    <span className="mb-1 block font-medium text-neutral-300">Price breaks</span>
                    <input className="vendor-field w-full rounded-lg px-3 py-2 text-sm text-white" value={offerBreaks} onChange={(e) => setOfferBreaks(e.target.value)} />
                  </label>
                </div>
                <button
                  type="button"
                  className="mt-3 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
                  onClick={() => {
                    if (!activePool) return;
                    upsertPoolWiseTenant({ tenantId: offerSupplierId || "supplier_demo", name: offerSupplierName || offerSupplierId || "Supplier" });
                    createSupplierOffer({
                      poolId: activePool.id,
                      supplierTenantId: offerSupplierId || "supplier_demo",
                      supplierName: offerSupplierName || offerSupplierId || "Supplier",
                      productLabel: offerProductLabel || activePool.productQuery || "Product",
                      currency: "USD",
                      moq: Number(offerMoq),
                      leadTimeDays: Number(offerLead),
                      priceBreaks: parseBreaks(offerBreaks),
                      notes: "",
                    });
                  }}
                >
                  Add offer to active pool
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {tab === "contributions" ? (
          <section className="vendor-panel-soft rounded-2xl p-6">
            <h2 className="text-base font-semibold text-white">Contributions</h2>
            {!activePool ? <p className="mt-2 text-sm text-neutral-500">Select an active pool under Pools.</p> : (
              <>
                <p className="mt-2 text-sm text-neutral-400">Supports reduced contributions and dropouts; contributions are tracked as a ledger (local-first).</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <label className="block text-xs text-neutral-400">
                    <span className="mb-1 block font-medium text-neutral-300">Tenant id</span>
                    <input className="vendor-field w-full rounded-lg px-3 py-2 text-sm text-white" value={contribTenantId} onChange={(e) => setContribTenantId(e.target.value)} />
                  </label>
                  <label className="block text-xs text-neutral-400 sm:col-span-2">
                    <span className="mb-1 block font-medium text-neutral-300">Tenant name</span>
                    <input className="vendor-field w-full rounded-lg px-3 py-2 text-sm text-white" value={contribTenantName} onChange={(e) => setContribTenantName(e.target.value)} />
                  </label>
                  <label className="block text-xs text-neutral-400">
                    <span className="mb-1 block font-medium text-neutral-300">Amount</span>
                    <input className="vendor-field w-full rounded-lg px-3 py-2 text-sm text-white" value={contribAmount} onChange={(e) => setContribAmount(e.target.value)} />
                  </label>
                </div>
                <button
                  type="button"
                  className="mt-3 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
                  onClick={() => {
                    if (!contribTenantId.trim()) return;
                    upsertPoolWiseTenant({ tenantId: contribTenantId, name: contribTenantName || contribTenantId });
                    joinPool({ poolId: activePool.id, tenantId: contribTenantId, tenantName: contribTenantName || contribTenantId });
                    recordContribution({
                      poolId: activePool.id,
                      tenantId: contribTenantId,
                      tenantName: contribTenantName || contribTenantId,
                      kind: "contribute",
                      amount: Number(contribAmount),
                      memo: "Contribution",
                    });
                    setContribAmount("0");
                  }}
                >
                  Record contribution
                </button>
              </>
            )}
          </section>
        ) : null}

        {tab === "allocation" ? (
          <section className="vendor-panel-soft rounded-2xl p-6">
            <h2 className="text-base font-semibold text-white">Allocation</h2>
            {!activePool ? <p className="mt-2 text-sm text-neutral-500">Select an active pool under Pools.</p> : (
              <>
                <p className="mt-2 text-sm text-neutral-400">
                  Allocation modes supported: by contribution, by ordered qty, or admin override. This screen suggests an allocation using the selected supplier offer and total order quantity.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <label className="block text-xs text-neutral-400 sm:col-span-2">
                    <span className="mb-1 block font-medium text-neutral-300">Offer</span>
                    <select className="vendor-field w-full rounded-lg px-3 py-2 text-sm text-white" value={allocOfferId} onChange={(e) => setAllocOfferId(e.target.value)}>
                      <option value="">Select…</option>
                      {offers.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.supplierName} · MOQ {o.moq} · breaks {o.priceBreaks.map((b) => `${b.minQty}:${money(b.unitPrice)}`).join(", ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs text-neutral-400">
                    <span className="mb-1 block font-medium text-neutral-300">Total qty</span>
                    <input className="vendor-field w-full rounded-lg px-3 py-2 text-sm text-white" value={allocQty} onChange={(e) => setAllocQty(e.target.value)} />
                  </label>
                </div>
                <div className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-neutral-950/80">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="border-b border-white/10 bg-neutral-950 text-xs font-semibold uppercase tracking-wide text-neutral-300">
                      <tr>
                        <th className="px-3 py-2">Tenant</th>
                        <th className="px-3 py-2 text-right">Allocated qty</th>
                        <th className="px-3 py-2 text-right">Unit price</th>
                        <th className="px-3 py-2 text-right">Value</th>
                        <th className="px-3 py-2">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      {suggestions.map((s) => (
                        <tr key={s.tenantId}>
                          <td className="px-3 py-2 text-neutral-200">{s.tenantName}</td>
                          <td className="px-3 py-2 text-right font-mono text-neutral-200">{s.allocatedQty}</td>
                          <td className="px-3 py-2 text-right font-mono text-neutral-200">{money(s.unitPrice)}</td>
                          <td className="px-3 py-2 text-right font-mono text-neutral-200">{money(s.allocatedValue)}</td>
                          <td className="px-3 py-2 text-neutral-400">{s.reason}</td>
                        </tr>
                      ))}
                      {suggestions.length === 0 ? <tr><td className="px-3 py-6 text-neutral-500" colSpan={5}>Pick an offer and set total qty.</td></tr> : null}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        ) : null}
      </div>
    </>
  );
}

