"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { PassportImageSlot } from "@/modules/dashboard/settings/staff/passport-image-slot";
import { listIdeliverLedgerEntries } from "@/modules/pos/services/ideliver-ledger";
import { loadIdeliverProviders, saveIdeliverProviders } from "@/modules/pos/services/ideliver-repo";
import {
  emptyIdeliverProvider,
  type IdeliverExternalProvider,
  type IdeliverFareBand,
} from "./ideliver-types";

function providerSummary(p: IdeliverExternalProvider, index: number): string {
  const n = p.fullName.trim();
  return n.length > 0 ? n : `External provider ${index + 1}`;
}

export function IdeliverSettingsForm() {
  const listId = useId();
  const nextProvSeq = useRef(1);

  const [providers, setProviders] = useState<IdeliverExternalProvider[]>(() => {
    if (typeof window === "undefined") return [emptyIdeliverProvider("ssr")];
    const list = loadIdeliverProviders();
    return list.length > 0 ? list : [emptyIdeliverProvider(`${listId}-p0`)];
  });
  const [expandedProviderId, setExpandedProviderId] = useState<string | null>(null);
  const [savedHint, setSavedHint] = useState<string | null>(null);
  const [ledgerTick, setLedgerTick] = useState(0);

  useEffect(() => {
    const h = () => setLedgerTick((t) => t + 1);
    window.addEventListener("seigen-ideliver-ledger-updated", h);
    return () => window.removeEventListener("seigen-ideliver-ledger-updated", h);
  }, []);

  const ledgerPreview = listIdeliverLedgerEntries(8);
  void ledgerTick;

  const updateProvider = useCallback((id: string, patch: Partial<IdeliverExternalProvider>) => {
    setProviders((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const addProvider = useCallback(() => {
    const id = `${listId}-p${nextProvSeq.current++}`;
    setProviders((rows) => [...rows, emptyIdeliverProvider(id)]);
    setExpandedProviderId(id);
  }, [listId]);

  const removeProvider = useCallback((id: string) => {
    setProviders((rows) => (rows.length <= 1 ? rows : rows.filter((r) => r.id !== id)));
    setExpandedProviderId((cur) => (cur === id ? null : cur));
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    saveIdeliverProviders(providers);
    window.dispatchEvent(new Event("seigen-ideliver-updated"));
    setSavedHint("Saved to this browser — POS loads providers & fare bands from the same data.");
    window.setTimeout(() => setSavedHint(null), 4000);
  }

  function addFareBand(providerId: string, rows: IdeliverFareBand[]) {
    const last = rows[rows.length - 1];
    const nextMax = (last?.maxRadiusKm ?? 0) + 5;
    updateProvider(providerId, {
      fareBands: [
        ...rows,
        { id: `fb_${Date.now()}`, maxRadiusKm: nextMax, fee: last?.fee ?? 0 },
      ],
    });
  }

  function updateFareBand(providerId: string, rows: IdeliverFareBand[], id: string, patch: Partial<IdeliverFareBand>) {
    updateProvider(providerId, {
      fareBands: rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    });
  }

  function removeFareBand(providerId: string, rows: IdeliverFareBand[], id: string) {
    if (rows.length <= 1) return;
    updateProvider(providerId, { fareBands: rows.filter((r) => r.id !== id) });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="vendor-panel-soft rounded-2xl px-5 py-4 text-sm text-neutral-300">
        <p className="font-medium text-white">iDeliver — instore-verified delivery</p>
        <p className="mt-2 leading-relaxed text-neutral-400">
          iDeliver is <strong className="font-semibold text-neutral-200">instore verified</strong> delivery logistics: your
          own staff or <strong className="font-semibold text-neutral-200">outside service providers</strong> you enlist
          under a separate agreement to perform collection or delivery on your behalf. It is not a generic marketplace
          courier network — you remain responsible for vetting who represents your business.
        </p>
        <p className="mt-3 leading-relaxed text-neutral-400">
          Where you engage an <strong className="font-semibold text-neutral-200">independent contractor, driver, or
          logistics partner</strong>, you are entitled to collect the information needed to verify identity, eligibility to
          drive or handle goods, and suitability for customer-facing work. That routinely includes a clear photograph,
          full legal name, national or government ID number, contact details, residential or service address, driver&apos;s
          licence number, and a recent police clearance or equivalent background check — the same class of data
          employers and licenced operators use for due diligence. You should only collect what is{" "}
          <strong className="font-semibold text-neutral-200">reasonable for the role</strong>, store it securely, and use
          it only for onboarding, audit, and safety — in line with your privacy policy and applicable law.
        </p>
        <p className="mt-3 leading-relaxed text-neutral-400">
          By uploading documents below, you confirm that you have a <strong className="font-semibold text-neutral-200">
          lawful basis</strong> to process this information (for example consent and/or legitimate interest in operating
          safe delivery), that providers understand why their data is collected, and that images are proportionate
          (e.g. ID-style photo and legible scans). seiGEN provides the form;{" "}
          <strong className="font-semibold text-neutral-200">your business remains the data controller</strong> for
          provider files until a hosted workflow and retention rules are connected.
        </p>
        <p className="mt-3 text-xs leading-relaxed text-neutral-500">
          This text is informational, not legal advice. Have your counsel review onboarding flows and retention for your
          jurisdiction.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-white">External service providers</h2>
        <button
          type="button"
          onClick={addProvider}
          className="rounded-lg border border-white/20 bg-neutral-800/80 px-3 py-1.5 text-sm font-semibold text-neutral-100 hover:bg-neutral-700"
        >
          Add provider
        </button>
      </div>

      <p className="text-sm text-neutral-400">
        Each provider stays <strong className="text-neutral-200">collapsed</strong> until opened. Uploads are optimized to
        WebP in the browser for drafts; production storage will enforce size limits and access control.
      </p>

      <div className="space-y-3">
        {providers.map((p, index) => {
          const isOpen = expandedProviderId === p.id;
          return (
            <div key={p.id} className="vendor-panel rounded-2xl">
              {!isOpen ? (
                <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-5">
                  <button
                    type="button"
                    onClick={() => setExpandedProviderId(p.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Provider {index + 1}</span>
                    <span className="min-w-0 truncate font-medium text-white">{providerSummary(p, index)}</span>
                    <span className="shrink-0 text-xs text-neutral-500">
                      {p.nationalIdNumber.trim() ? `· ID on file` : "· Pending verification"}
                    </span>
                    <span className="shrink-0 text-neutral-500" aria-hidden>
                      ▸
                    </span>
                  </button>
                  {providers.length > 1 ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeProvider(p.id);
                      }}
                      className="shrink-0 text-xs font-medium text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="border-b border-white/10 px-4 py-3 sm:px-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedProviderId(null)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          Provider {index + 1}
                        </span>
                        <span className="min-w-0 truncate font-medium text-white">{providerSummary(p, index)}</span>
                        <span className="shrink-0 text-xs text-neutral-400">Click to collapse</span>
                        <span className="shrink-0 text-neutral-500" aria-hidden>
                          ▾
                        </span>
                      </button>
                      {providers.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeProvider(p.id)}
                          className="text-xs font-medium text-red-400 hover:text-red-300"
                        >
                          Remove provider
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-6 p-6 pt-4">
                    <div>
                      <h3 className="text-base font-semibold text-white">Identity &amp; photo</h3>
                      <p className="mt-1 text-sm text-neutral-400">
                        Clear facial image for recognition on pickup or handover (optimized WebP).
                      </p>
                      <div className="mt-4 max-w-md">
                        <PassportImageSlot
                          label="Provider photo (ID-style)"
                          description="Recent, well-lit face photo for verification."
                          value={p.photoWebp}
                          onChange={(v) => updateProvider(p.id, { photoWebp: v })}
                        />
                      </div>
                    </div>

                    <div>
                      <h3 className="text-base font-semibold text-white">Personal &amp; ID</h3>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium text-neutral-200" htmlFor={`idv-name-${p.id}`}>
                            Full legal name
                          </label>
                          <input
                            id={`idv-name-${p.id}`}
                            value={p.fullName}
                            onChange={(e) => updateProvider(p.id, { fullName: e.target.value })}
                            className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                            autoComplete="name"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-neutral-200" htmlFor={`idv-nin-${p.id}`}>
                            National / ID number
                          </label>
                          <input
                            id={`idv-nin-${p.id}`}
                            value={p.nationalIdNumber}
                            onChange={(e) => updateProvider(p.id, { nationalIdNumber: e.target.value })}
                            className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-neutral-200" htmlFor={`idv-lic-${p.id}`}>
                            Driver&apos;s licence number
                          </label>
                          <input
                            id={`idv-lic-${p.id}`}
                            value={p.driversLicenseNumber}
                            onChange={(e) => updateProvider(p.id, { driversLicenseNumber: e.target.value })}
                            className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-base font-semibold text-white">Contact</h3>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="block text-sm font-medium text-neutral-200" htmlFor={`idv-phone-${p.id}`}>
                            Phone
                          </label>
                          <input
                            id={`idv-phone-${p.id}`}
                            type="tel"
                            value={p.phone}
                            onChange={(e) => updateProvider(p.id, { phone: e.target.value })}
                            className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-neutral-200" htmlFor={`idv-email-${p.id}`}>
                            Email
                          </label>
                          <input
                            id={`idv-email-${p.id}`}
                            type="email"
                            value={p.email}
                            onChange={(e) => updateProvider(p.id, { email: e.target.value })}
                            className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-base font-semibold text-white">Address</h3>
                      <label className="block text-sm font-medium text-neutral-200" htmlFor={`idv-addr-${p.id}`}>
                        Residential / service address
                      </label>
                      <textarea
                        id={`idv-addr-${p.id}`}
                        value={p.address}
                        onChange={(e) => updateProvider(p.id, { address: e.target.value })}
                        rows={3}
                        className="vendor-field mt-1 w-full resize-y rounded-lg px-3 py-2 text-sm"
                        placeholder="Street, suburb, city — as required for your checks"
                      />
                    </div>

                    <div>
                      <h3 className="text-base font-semibold text-white">Fares by radius &amp; business conditions</h3>
                      <p className="mt-1 text-sm text-neutral-400">
                        POS picks the first tier where customer distance (km) is within{" "}
                        <span className="text-neutral-200">max radius</span>. Add wider bands for outer suburbs. Override
                        remains available at the till.
                      </p>
                      <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
                        <table className="w-full min-w-[320px] text-left text-sm">
                          <thead className="border-b border-white/10 bg-white/[0.04] text-xs uppercase tracking-wide text-neutral-400">
                            <tr>
                              <th className="px-3 py-2">Max radius (km)</th>
                              <th className="px-3 py-2">Fee</th>
                              <th className="px-3 py-2 w-24" />
                            </tr>
                          </thead>
                          <tbody>
                            {p.fareBands.map((row) => (
                              <tr key={row.id} className="border-b border-white/5">
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    min={0.1}
                                    step="any"
                                    value={row.maxRadiusKm}
                                    onChange={(e) =>
                                      updateFareBand(p.id, p.fareBands, row.id, {
                                        maxRadiusKm: Number(e.target.value),
                                      })
                                    }
                                    className="vendor-field w-full rounded px-2 py-1 text-sm"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    min={0}
                                    step="any"
                                    value={row.fee}
                                    onChange={(e) =>
                                      updateFareBand(p.id, p.fareBands, row.id, {
                                        fee: Number(e.target.value),
                                      })
                                    }
                                    className="vendor-field w-full rounded px-2 py-1 text-sm"
                                  />
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <button
                                    type="button"
                                    onClick={() => removeFareBand(p.id, p.fareBands, row.id)}
                                    className="text-xs font-medium text-red-400 hover:text-red-300"
                                  >
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <button
                        type="button"
                        onClick={() => addFareBand(p.id, p.fareBands)}
                        className="mt-2 text-xs font-semibold text-teal-600 hover:underline"
                      >
                        Add radius band
                      </button>
                      <label className="mt-4 block text-sm font-medium text-neutral-200" htmlFor={`idv-cond-${p.id}`}>
                        Conditions of business (min order, surcharges, vehicle, hours…)
                      </label>
                      <textarea
                        id={`idv-cond-${p.id}`}
                        value={p.businessConditions}
                        onChange={(e) => updateProvider(p.id, { businessConditions: e.target.value })}
                        rows={4}
                        className="vendor-field mt-1 w-full resize-y rounded-lg px-3 py-2 text-sm"
                        placeholder="e.g. Minimum basket $25 · no delivery after 20:00 · bike only within 3km"
                      />
                    </div>

                    <div>
                      <h3 className="text-base font-semibold text-white">Police clearance</h3>
                      <p className="mt-1 text-sm text-neutral-400">
                        Upload a legible scan or photo of the certificate (WebP). PDF support can be added with secure
                        storage.
                      </p>
                      <div className="mt-4 max-w-md">
                        <PassportImageSlot
                          label="Police clearance / background check"
                          description="Recent clearance suitable for customer-facing delivery."
                          value={p.policeClearanceWebp}
                          onChange={(v) => updateProvider(p.id, { policeClearanceWebp: v })}
                        />
                      </div>
                    </div>

                    <div>
                      <h3 className="text-base font-semibold text-white">Other</h3>
                      <label className="block text-sm font-medium text-neutral-200" htmlFor={`idv-notes-${p.id}`}>
                        Additional notes (vehicle reg, insurance ref, contract ref…)
                      </label>
                      <textarea
                        id={`idv-notes-${p.id}`}
                        value={p.additionalNotes}
                        onChange={(e) => updateProvider(p.id, { additionalNotes: e.target.value })}
                        rows={3}
                        className="vendor-field mt-1 w-full resize-y rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="vendor-panel rounded-2xl p-5">
        <h3 className="text-base font-semibold text-white">Provider delivery ledger (local)</h3>
        <p className="mt-1 text-xs text-neutral-500">
          Each completed POS sale with a delivery fee credits the selected provider here for payout / COA mapping.
        </p>
        {ledgerPreview.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-400">No delivery credits recorded yet.</p>
        ) : (
          <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-xs text-neutral-300">
            {ledgerPreview.map((e) => (
              <li key={e.id} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
                <span className="font-mono text-teal-600">{e.receiptNumber}</span>
                <span className="text-neutral-500"> · </span>
                <span className="text-neutral-200">{e.providerName}</span>
                <span className="float-right font-semibold text-white">{e.deliveryFee}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="vendor-panel-soft rounded-2xl px-5 py-4 text-sm text-neutral-300">
        <p className="font-medium text-white">Catalogues &amp; storefronts</p>
        <p className="mt-1 text-neutral-400">
          On the <strong className="text-neutral-200">inventory item list</strong> and when you mark a product for{" "}
          <strong className="text-neutral-200">external iDeliver</strong>, listings show an{" "}
          <strong className="text-neutral-200">External iDeliver</strong> flag so buyers and staff see that fulfilment
          may involve a verified outside provider rather than only instore employees. Configure the flag on each product
          under <span className="text-neutral-200">Catalog &amp; iDeliver</span> on the add/edit product screen.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-95"
        >
          Save draft
        </button>
        {savedHint ? <p className="text-sm text-neutral-400">{savedHint}</p> : null}
      </div>
    </form>
  );
}
