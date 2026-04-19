"use client";

import Link from "next/link";
import { useState } from "react";
import { WEEKDAYS, type ShopBranch, type Weekday } from "@/modules/dashboard/settings/branches/branch-types";
import { useVendorBranches } from "@/modules/dashboard/settings/branches/vendor-branches-context";
import { useVendorRoles } from "@/modules/dashboard/settings/roles/vendor-roles-context";
import { displayStaffSummary } from "@/modules/dashboard/settings/staff/staff-types";
import { useVendorStaff } from "@/modules/dashboard/settings/staff/vendor-staff-context";

function formatLocationLine(b: ShopBranch): string {
  const parts = [b.suburb, b.city].map((x) => x.trim()).filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "No address yet";
}

function branchCardTitle(b: ShopBranch, index: number): string {
  const name = b.shopName.trim();
  if (name.length > 0) return name;
  return `Shop ${index + 1}`;
}

export function BranchesSettingsForm() {
  const { branches, updateBranch, updateBranchHours, addBranch, removeBranch, expandedBranchId, setExpandedBranchId } =
    useVendorBranches();
  const { staffMembers } = useVendorStaff();
  const { roles } = useVendorRoles();
  const [savedHint, setSavedHint] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavedHint("Draft saved locally — workspace persistence is not wired yet.");
    window.setTimeout(() => setSavedHint(null), 4000);
  }

  function staffAtBranch(branchId: string) {
    return staffMembers.filter((s) => s.branchId === branchId);
  }

  function roleLabel(roleId: string): string {
    const r = roles.find((x) => x.id === roleId);
    if (!r) return roleId ? "Role removed" : "—";
    return r.name.trim() || "Untitled role";
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="vendor-panel-soft rounded-2xl px-5 py-4 text-sm text-neutral-300">
        <p className="font-medium text-white">Shops &amp; branches</p>
        <p className="mt-1 text-neutral-400">
          Each shop has its own name, address down to suburb, contacts, hours, and notes. Staff assigned here appear in
          the Staff tab by shop; assign roles under{" "}
          <Link href="/dashboard/settings?tab=roles-permissions" className="text-brand-orange hover:underline">
            Roles &amp; permissions
          </Link>
          .
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-white">Locations</h2>
        <button
          type="button"
          onClick={() => addBranch()}
          className="rounded-lg border border-white/20 bg-neutral-800/80 px-3 py-1.5 text-sm font-semibold text-neutral-100 hover:bg-neutral-700"
        >
          Add shop
        </button>
      </div>

      <div className="space-y-3">
        {branches.map((b, index) => {
          const isOpen = expandedBranchId === b.id;
          const attached = staffAtBranch(b.id);

          return (
            <div key={b.id} className="vendor-panel rounded-2xl">
              {!isOpen ? (
                <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-5">
                  <button
                    type="button"
                    onClick={() => setExpandedBranchId(b.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Shop {index + 1}</span>
                    <span className="min-w-0 truncate font-medium text-white">{branchCardTitle(b, index)}</span>
                    <span className="shrink-0 text-xs text-neutral-500">· {formatLocationLine(b)}</span>
                    <span className="shrink-0 text-xs text-neutral-500">· {attached.length} staff</span>
                    <span className="shrink-0 text-neutral-500" aria-hidden>
                      ▸
                    </span>
                  </button>
                  {branches.length > 1 ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeBranch(b.id);
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
                        onClick={() => setExpandedBranchId(null)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          Shop {index + 1}
                        </span>
                        <span className="min-w-0 truncate font-medium text-white">{branchCardTitle(b, index)}</span>
                        <span className="shrink-0 text-xs text-neutral-400">Click to collapse</span>
                        <span className="shrink-0 text-neutral-500" aria-hidden>
                          ▾
                        </span>
                      </button>
                      {branches.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeBranch(b.id)}
                          className="text-xs font-medium text-red-400 hover:text-red-300"
                        >
                          Remove shop
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-6 p-6 pt-4">
                    <div>
                      <h3 className="text-base font-semibold text-white">Shop name</h3>
                      <div className="mt-4 max-w-xl">
                        <label className="block text-sm font-medium text-neutral-200" htmlFor={`br-name-${b.id}`}>
                          Trading / shop name
                        </label>
                        <input
                          id={`br-name-${b.id}`}
                          value={b.shopName}
                          onChange={(e) => updateBranch(b.id, { shopName: e.target.value })}
                          className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                          placeholder="e.g. seiGEN Mall of Africa"
                        />
                      </div>
                    </div>

                    <div>
                      <h3 className="text-base font-semibold text-white">Location</h3>
                      <p className="mt-1 text-sm text-neutral-400">Street through suburb — used on receipts and maps.</p>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium text-neutral-200" htmlFor={`br-l1-${b.id}`}>
                            Street address line 1
                          </label>
                          <input
                            id={`br-l1-${b.id}`}
                            value={b.streetLine1}
                            onChange={(e) => updateBranch(b.id, { streetLine1: e.target.value })}
                            className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium text-neutral-200" htmlFor={`br-l2-${b.id}`}>
                            Street address line 2
                          </label>
                          <input
                            id={`br-l2-${b.id}`}
                            value={b.streetLine2}
                            onChange={(e) => updateBranch(b.id, { streetLine2: e.target.value })}
                            className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                            placeholder="Building, suite, floor (optional)"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-neutral-200" htmlFor={`br-sub-${b.id}`}>
                            Suburb
                          </label>
                          <input
                            id={`br-sub-${b.id}`}
                            value={b.suburb}
                            onChange={(e) => updateBranch(b.id, { suburb: e.target.value })}
                            className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-neutral-200" htmlFor={`br-city-${b.id}`}>
                            City / town
                          </label>
                          <input
                            id={`br-city-${b.id}`}
                            value={b.city}
                            onChange={(e) => updateBranch(b.id, { city: e.target.value })}
                            className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-neutral-200" htmlFor={`br-reg-${b.id}`}>
                            Region / province
                          </label>
                          <input
                            id={`br-reg-${b.id}`}
                            value={b.region}
                            onChange={(e) => updateBranch(b.id, { region: e.target.value })}
                            className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-neutral-200" htmlFor={`br-pc-${b.id}`}>
                            Postal code
                          </label>
                          <input
                            id={`br-pc-${b.id}`}
                            value={b.postalCode}
                            onChange={(e) => updateBranch(b.id, { postalCode: e.target.value })}
                            className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium text-neutral-200" htmlFor={`br-ct-${b.id}`}>
                            Country
                          </label>
                          <input
                            id={`br-ct-${b.id}`}
                            value={b.country}
                            onChange={(e) => updateBranch(b.id, { country: e.target.value })}
                            className="vendor-field mt-1 w-full max-w-md rounded-lg px-3 py-2 text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-base font-semibold text-white">Shop contact</h3>
                      <p className="mt-1 text-sm text-neutral-400">Who customers and couriers reach for this location.</p>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="block text-sm font-medium text-neutral-200" htmlFor={`br-cn-${b.id}`}>
                            Contact name
                          </label>
                          <input
                            id={`br-cn-${b.id}`}
                            value={b.contactName}
                            onChange={(e) => updateBranch(b.id, { contactName: e.target.value })}
                            className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-neutral-200" htmlFor={`br-ce-${b.id}`}>
                            Shop email
                          </label>
                          <input
                            id={`br-ce-${b.id}`}
                            type="email"
                            value={b.contactEmail}
                            onChange={(e) => updateBranch(b.id, { contactEmail: e.target.value })}
                            className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-neutral-200" htmlFor={`br-cp-${b.id}`}>
                            Main phone
                          </label>
                          <input
                            id={`br-cp-${b.id}`}
                            type="tel"
                            value={b.contactPhone}
                            onChange={(e) => updateBranch(b.id, { contactPhone: e.target.value })}
                            className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-neutral-200" htmlFor={`br-ca-${b.id}`}>
                            Alternate phone
                          </label>
                          <input
                            id={`br-ca-${b.id}`}
                            type="tel"
                            value={b.contactAlternatePhone}
                            onChange={(e) => updateBranch(b.id, { contactAlternatePhone: e.target.value })}
                            className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-base font-semibold text-white">Business hours</h3>
                      <p className="mt-1 text-sm text-neutral-400">Used for storefront hours and staff scheduling hints.</p>
                      <div className="mt-4 space-y-3">
                        {WEEKDAYS.map(({ id: day, label }) => {
                          const h = b.businessHours[day as Weekday];
                          return (
                            <div
                              key={day}
                              className="flex flex-wrap items-end gap-3 rounded-lg border border-white/10 bg-neutral-900/30 px-3 py-3 sm:items-center"
                            >
                              <span className="w-28 shrink-0 text-sm font-medium text-neutral-200">{label}</span>
                              <label className="flex items-center gap-2 text-xs text-neutral-400">
                                <input
                                  type="checkbox"
                                  checked={h.closed}
                                  onChange={(e) => updateBranchHours(b.id, day as Weekday, { closed: e.target.checked })}
                                  className="h-4 w-4 accent-brand-orange"
                                />
                                Closed
                              </label>
                              {!h.closed ? (
                                <>
                                  <div>
                                    <label className="sr-only" htmlFor={`br-${b.id}-open-${day}`}>
                                      Opens
                                    </label>
                                    <input
                                      id={`br-${b.id}-open-${day}`}
                                      type="time"
                                      value={h.open}
                                      onChange={(e) => updateBranchHours(b.id, day as Weekday, { open: e.target.value })}
                                      className="vendor-field rounded-lg px-2 py-1.5 text-sm"
                                    />
                                  </div>
                                  <span className="text-neutral-500">–</span>
                                  <div>
                                    <label className="sr-only" htmlFor={`br-${b.id}-close-${day}`}>
                                      Closes
                                    </label>
                                    <input
                                      id={`br-${b.id}-close-${day}`}
                                      type="time"
                                      value={h.close}
                                      onChange={(e) => updateBranchHours(b.id, day as Weekday, { close: e.target.value })}
                                      className="vendor-field rounded-lg px-2 py-1.5 text-sm"
                                    />
                                  </div>
                                </>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-base font-semibold text-white">Team at this shop</h3>
                      <p className="mt-1 text-sm text-neutral-400">
                        Pulled from the Staff tab where each person&apos;s shop matches this location. Roles come from{" "}
                        <Link href="/dashboard/settings?tab=roles-permissions" className="text-brand-orange hover:underline">
                          Roles &amp; permissions
                        </Link>
                        .
                      </p>
                      {attached.length === 0 ? (
                        <p className="mt-3 rounded-lg border border-dashed border-white/15 bg-neutral-900/30 px-4 py-6 text-center text-sm text-neutral-500">
                          No staff linked yet — open the{" "}
                          <Link href="/dashboard/settings?tab=staff" className="text-brand-orange hover:underline">
                            Staff
                          </Link>{" "}
                          tab and assign this shop.
                        </p>
                      ) : (
                        <ul className="mt-4 divide-y divide-white/10 rounded-lg border border-white/10">
                          {attached.map((s, si) => (
                            <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                              <span className="font-medium text-white">{displayStaffSummary(s, si)}</span>
                              <span className="text-xs text-neutral-400">
                                Role: <span className="text-neutral-200">{roleLabel(s.assignedRoleId)}</span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div>
                      <h3 className="text-base font-semibold text-white">Other details</h3>
                      <p className="mt-1 text-sm text-neutral-400">
                        Trading licence ref, landlord, mall unit ID, delivery bay, tax office code — anything specific to
                        this shop.
                      </p>
                      <textarea
                        value={b.otherNotes}
                        onChange={(e) => updateBranch(b.id, { otherNotes: e.target.value })}
                        rows={4}
                        className="vendor-field mt-4 w-full resize-y rounded-lg px-3 py-2 text-sm"
                        placeholder="Notes for compliance, integrations, or operations…"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-95"
        >
          Save draft
        </button>
        {savedHint ? <p className="text-sm text-neutral-400">{savedHint}</p> : null}
      </div>
    </form>
  );
}
