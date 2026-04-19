"use client";

import Link from "next/link";
import { useState } from "react";
import { useVendorBranches } from "@/modules/dashboard/settings/branches/vendor-branches-context";
import { useVendorRoles } from "@/modules/dashboard/settings/roles/vendor-roles-context";
import { STAFF_ACTIVITY_CATEGORIES, displayStaffSummary } from "@/modules/dashboard/settings/staff/staff-types";
import { useVendorStaff } from "@/modules/dashboard/settings/staff/vendor-staff-context";
import { PassportImageSlot } from "@/modules/dashboard/settings/staff/passport-image-slot";

export type { StaffMember } from "@/modules/dashboard/settings/staff/staff-types";

export function StaffSettingsForm() {
  const { roles } = useVendorRoles();
  const { branches } = useVendorBranches();
  const {
    staffMembers,
    updateStaff,
    addStaff,
    removeStaff,
    expandedStaffId,
    setExpandedStaffId,
    updateJob,
    addJob,
    removeJob,
    updateActivity,
    addActivity,
    removeActivity,
  } = useVendorStaff();

  const [savedHint, setSavedHint] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavedHint("Draft saved locally — workspace persistence is not wired yet.");
    window.setTimeout(() => setSavedHint(null), 4000);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="vendor-panel-soft rounded-2xl px-5 py-4 text-sm text-neutral-300">
        <p className="font-medium text-white">Staff & access</p>
        <p className="mt-1 text-neutral-400">
          Add people on your team; each card stays collapsed until you open it. Assign them to a shop from the Branches
          tab, attach roles, and keep HR notes per person.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-white">People</h2>
        <button
          type="button"
          onClick={addStaff}
          className="rounded-lg border border-white/20 bg-neutral-800/80 px-3 py-1.5 text-sm font-semibold text-neutral-100 hover:bg-neutral-700"
        >
          Add staff
        </button>
      </div>

      <div className="space-y-3">
        {staffMembers.map((member, memberIndex) => {
          const isOpen = expandedStaffId === member.id;
          const selectedRole = member.assignedRoleId
            ? roles.find((r) => r.id === member.assignedRoleId)
            : undefined;
          const roleLabel = selectedRole
            ? selectedRole.name.trim() || "Untitled role"
            : member.assignedRoleId
              ? "Role removed"
              : "No role";

          return (
            <div key={member.id} className="vendor-panel rounded-2xl">
              {!isOpen ? (
                <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-5">
                  <button
                    type="button"
                    onClick={() => setExpandedStaffId(member.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Staff {memberIndex + 1}
                    </span>
                    <span className="min-w-0 truncate font-medium text-white">{displayStaffSummary(member, memberIndex)}</span>
                    <span className="shrink-0 text-xs text-neutral-500">· {roleLabel}</span>
                    <span className="shrink-0 text-neutral-500" aria-hidden>
                      ▸
                    </span>
                  </button>
                  {staffMembers.length > 1 ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeStaff(member.id);
                      }}
                      className="shrink-0 text-xs font-medium text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="border-b border-white/10 px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setExpandedStaffId(null)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Staff {memberIndex + 1}
                      </span>
                      <span className="min-w-0 truncate font-medium text-white">{displayStaffSummary(member, memberIndex)}</span>
                      <span className="shrink-0 text-xs text-neutral-400">Click to collapse</span>
                      <span className="shrink-0 text-neutral-500" aria-hidden>
                        ▾
                      </span>
                    </button>
                    {staffMembers.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeStaff(member.id)}
                        className="text-xs font-medium text-red-400 hover:text-red-300"
                      >
                        Remove staff
                      </button>
                    ) : null}
                  </div>
                </div>
              )}

              {isOpen ? (
                <div className="space-y-6 p-6 pt-4">
                  <div>
                    <h3 className="text-base font-semibold text-white">Personal details</h3>
                    <p className="mt-1 text-sm text-neutral-400">Legal name and identifiers for HR and payroll alignment.</p>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <label
                          className="block text-sm font-medium text-neutral-200"
                          htmlFor={`st-first-${member.id}`}
                        >
                          First name
                        </label>
                        <input
                          id={`st-first-${member.id}`}
                          value={member.firstName}
                          onChange={(e) => updateStaff(member.id, { firstName: e.target.value })}
                          autoComplete="given-name"
                          className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-200" htmlFor={`st-last-${member.id}`}>
                          Last name
                        </label>
                        <input
                          id={`st-last-${member.id}`}
                          value={member.lastName}
                          onChange={(e) => updateStaff(member.id, { lastName: e.target.value })}
                          autoComplete="family-name"
                          className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-200" htmlFor={`st-dob-${member.id}`}>
                          Date of birth
                        </label>
                        <input
                          id={`st-dob-${member.id}`}
                          type="date"
                          value={member.dateOfBirth}
                          onChange={(e) => updateStaff(member.id, { dateOfBirth: e.target.value })}
                          className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-200" htmlFor={`st-eid-${member.id}`}>
                          Employee / payroll ID
                        </label>
                        <input
                          id={`st-eid-${member.id}`}
                          value={member.employeeId}
                          onChange={(e) => updateStaff(member.id, { employeeId: e.target.value })}
                          className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                          placeholder="Internal reference"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-white">Passport / national ID</h3>
                    <p className="mt-1 text-sm text-neutral-400">
                      Upload the photo page (front) and any back page or barcode strip required by HR. Files are converted
                      to WebP in the browser for a smaller draft payload until secure storage is connected.
                    </p>
                    <div className="mt-4 grid gap-6 sm:grid-cols-2">
                      <PassportImageSlot
                        label="Passport — front"
                        description="Face page or main ID side."
                        value={member.passportFrontWebp}
                        onChange={(v) => updateStaff(member.id, { passportFrontWebp: v })}
                      />
                      <PassportImageSlot
                        label="Passport — back"
                        description="Endorsements, MRZ, or back of ID card."
                        value={member.passportBackWebp}
                        onChange={(v) => updateStaff(member.id, { passportBackWebp: v })}
                      />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-white">Contact details</h3>
                    <p className="mt-1 text-sm text-neutral-400">How to reach this person for shifts and notices.</p>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium text-neutral-200" htmlFor={`st-email-${member.id}`}>
                          Work email
                        </label>
                        <input
                          id={`st-email-${member.id}`}
                          type="email"
                          value={member.email}
                          onChange={(e) => updateStaff(member.id, { email: e.target.value })}
                          autoComplete="email"
                          className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-200" htmlFor={`st-phone-${member.id}`}>
                          Mobile phone
                        </label>
                        <input
                          id={`st-phone-${member.id}`}
                          type="tel"
                          value={member.phone}
                          onChange={(e) => updateStaff(member.id, { phone: e.target.value })}
                          autoComplete="tel"
                          className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label
                          className="block text-sm font-medium text-neutral-200"
                          htmlFor={`st-phone2-${member.id}`}
                        >
                          Alternate phone
                        </label>
                        <input
                          id={`st-phone2-${member.id}`}
                          type="tel"
                          value={member.alternatePhone}
                          onChange={(e) => updateStaff(member.id, { alternatePhone: e.target.value })}
                          className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-neutral-200" htmlFor={`st-addr-${member.id}`}>
                          Contact address
                        </label>
                        <textarea
                          id={`st-addr-${member.id}`}
                          value={member.contactAddress}
                          onChange={(e) => updateStaff(member.id, { contactAddress: e.target.value })}
                          rows={2}
                          className="vendor-field mt-1 w-full resize-y rounded-lg px-3 py-2 text-sm"
                          placeholder="Optional — mailing or emergency contact address"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-white">Shop / branch</h3>
                    <p className="mt-1 text-sm text-neutral-400">
                      Primary location from your Branches tab — used for registers, stock, and the team list on each shop.
                    </p>
                    <div className="mt-4 max-w-md">
                      <label className="block text-sm font-medium text-neutral-200" htmlFor={`st-branch-${member.id}`}>
                        Shop
                      </label>
                      <select
                        id={`st-branch-${member.id}`}
                        value={member.branchId}
                        onChange={(e) => updateStaff(member.id, { branchId: e.target.value })}
                        className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="">Select shop…</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.shopName.trim() || "Unnamed shop"}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-white">Roles and duties</h3>
                    <p className="mt-1 text-sm text-neutral-400">
                      Assign a role from{" "}
                      <Link
                        href="/dashboard/settings?tab=roles-permissions"
                        className="font-medium text-brand-orange underline-offset-2 hover:underline"
                      >
                        Roles &amp; permissions
                      </Link>
                      . Menu access for that role is defined there; add notes below for day-to-day duties.
                    </p>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-neutral-200" htmlFor={`st-role-${member.id}`}>
                          Role
                        </label>
                        <select
                          id={`st-role-${member.id}`}
                          value={member.assignedRoleId}
                          onChange={(e) => updateStaff(member.id, { assignedRoleId: e.target.value })}
                          className="vendor-field mt-1 w-full max-w-md rounded-lg px-3 py-2 text-sm"
                        >
                          <option value="">Select role…</option>
                          {roles.map((r) => {
                            const label = r.name.trim() || "Untitled role";
                            return (
                              <option key={r.id} value={r.id}>
                                {label}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                      {selectedRole ? (
                        <div className="sm:col-span-2 rounded-lg border border-white/10 bg-neutral-900/40 px-3 py-2 text-sm text-neutral-300">
                          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Role description</p>
                          <p className="mt-1 text-neutral-200">
                            {selectedRole.description.trim() ||
                              "No description yet — edit this role on Roles & permissions."}
                          </p>
                        </div>
                      ) : null}
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-neutral-200" htmlFor={`st-duties-${member.id}`}>
                          Additional duties (optional)
                        </label>
                        <textarea
                          id={`st-duties-${member.id}`}
                          value={member.duties}
                          onChange={(e) => updateStaff(member.id, { duties: e.target.value })}
                          rows={4}
                          className="vendor-field mt-1 w-full resize-y rounded-lg px-3 py-2 text-sm"
                          placeholder="Opening/closing, approvals, cash handling, receiving — beyond the role definition above"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-white">Previous employment</h3>
                        <p className="mt-1 text-sm text-neutral-400">
                          Employer, role, duties, and period. Add as many rows as needed.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => addJob(member.id)}
                        className="shrink-0 rounded-lg border border-white/20 bg-neutral-800/80 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-700"
                      >
                        Add employment
                      </button>
                    </div>

                    <div className="mt-4 space-y-4">
                      {member.previousJobs.map((row, index) => (
                        <div key={row.id} className="rounded-xl border border-white/10 bg-neutral-900/25 p-4">
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                              Position {index + 1}
                            </span>
                            {member.previousJobs.length > 1 ? (
                              <button
                                type="button"
                                onClick={() => removeJob(member.id, row.id)}
                                className="text-xs font-medium text-red-400 hover:text-red-300"
                              >
                                Remove
                              </button>
                            ) : null}
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                              <label
                                className="block text-xs font-medium text-neutral-400"
                                htmlFor={`st-prev-emp-${row.id}`}
                              >
                                Employer
                              </label>
                              <input
                                id={`st-prev-emp-${row.id}`}
                                value={row.employer}
                                onChange={(e) => updateJob(member.id, row.id, { employer: e.target.value })}
                                className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                                placeholder="Company name"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label
                                className="block text-xs font-medium text-neutral-400"
                                htmlFor={`st-prev-title-${row.id}`}
                              >
                                Job title
                              </label>
                              <input
                                id={`st-prev-title-${row.id}`}
                                value={row.jobTitle}
                                onChange={(e) => updateJob(member.id, row.id, { jobTitle: e.target.value })}
                                className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label
                                className="block text-xs font-medium text-neutral-400"
                                htmlFor={`st-prev-duties-${row.id}`}
                              >
                                Duties
                              </label>
                              <textarea
                                id={`st-prev-duties-${row.id}`}
                                value={row.duties}
                                onChange={(e) => updateJob(member.id, row.id, { duties: e.target.value })}
                                rows={2}
                                className="vendor-field mt-1 w-full resize-y rounded-lg px-3 py-2 text-sm"
                              />
                            </div>
                            <div>
                              <label
                                className="block text-xs font-medium text-neutral-400"
                                htmlFor={`st-prev-start-${row.id}`}
                              >
                                Start
                              </label>
                              <input
                                id={`st-prev-start-${row.id}`}
                                type="month"
                                value={row.startDate}
                                onChange={(e) => updateJob(member.id, row.id, { startDate: e.target.value })}
                                className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                              />
                            </div>
                            <div>
                              <label
                                className="block text-xs font-medium text-neutral-400"
                                htmlFor={`st-prev-end-${row.id}`}
                              >
                                End
                              </label>
                              <input
                                id={`st-prev-end-${row.id}`}
                                type="month"
                                value={row.endDate}
                                onChange={(e) => updateJob(member.id, row.id, { endDate: e.target.value })}
                                className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-white">Staff activity log</h3>
                        <p className="mt-1 text-sm text-neutral-400">
                          Chronological events for this person — dates, what happened, and follow-ups.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => addActivity(member.id)}
                        className="shrink-0 rounded-lg border border-white/20 bg-neutral-800/80 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-700"
                      >
                        Add entry
                      </button>
                    </div>

                    <div className="mt-4 space-y-4">
                      {member.activityLog.map((row, index) => (
                        <div key={row.id} className="rounded-xl border border-white/10 bg-neutral-900/25 p-4">
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                              Entry {index + 1}
                            </span>
                            {member.activityLog.length > 1 ? (
                              <button
                                type="button"
                                onClick={() => removeActivity(member.id, row.id)}
                                className="text-xs font-medium text-red-400 hover:text-red-300"
                              >
                                Remove
                              </button>
                            ) : null}
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <label
                                className="block text-xs font-medium text-neutral-400"
                                htmlFor={`st-act-date-${row.id}`}
                              >
                                Date
                              </label>
                              <input
                                id={`st-act-date-${row.id}`}
                                type="date"
                                value={row.occurredOn}
                                onChange={(e) => updateActivity(member.id, row.id, { occurredOn: e.target.value })}
                                className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                              />
                            </div>
                            <div>
                              <label
                                className="block text-xs font-medium text-neutral-400"
                                htmlFor={`st-act-cat-${row.id}`}
                              >
                                Category (BI dimension)
                              </label>
                              <select
                                id={`st-act-cat-${row.id}`}
                                value={row.category}
                                onChange={(e) => updateActivity(member.id, row.id, { category: e.target.value })}
                                className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                              >
                                {STAFF_ACTIVITY_CATEGORIES.map((c) => (
                                  <option key={c.value || "empty"} value={c.value}>
                                    {c.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="sm:col-span-2">
                              <label
                                className="block text-xs font-medium text-neutral-400"
                                htmlFor={`st-act-desc-${row.id}`}
                              >
                                Description
                              </label>
                              <textarea
                                id={`st-act-desc-${row.id}`}
                                value={row.description}
                                onChange={(e) => updateActivity(member.id, row.id, { description: e.target.value })}
                                rows={2}
                                className="vendor-field mt-1 w-full resize-y rounded-lg px-3 py-2 text-sm"
                                placeholder="What occurred — shift issue, customer event, coaching moment…"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label
                                className="block text-xs font-medium text-neutral-400"
                                htmlFor={`st-act-res-${row.id}`}
                              >
                                Resolution / outcome
                              </label>
                              <textarea
                                id={`st-act-res-${row.id}`}
                                value={row.resolution}
                                onChange={(e) => updateActivity(member.id, row.id, { resolution: e.target.value })}
                                rows={2}
                                className="vendor-field mt-1 w-full resize-y rounded-lg px-3 py-2 text-sm"
                                placeholder="How it was handled, decision, or closure"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label
                                className="block text-xs font-medium text-neutral-400"
                                htmlFor={`st-act-follow-${row.id}`}
                              >
                                Follow-up
                              </label>
                              <input
                                id={`st-act-follow-${row.id}`}
                                value={row.followUp}
                                onChange={(e) => updateActivity(member.id, row.id, { followUp: e.target.value })}
                                className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                                placeholder="Next review date, training booked, pending HR…"
                              />
                            </div>
                            <div>
                              <label
                                className="block text-xs font-medium text-neutral-400"
                                htmlFor={`st-act-by-${row.id}`}
                              >
                                Recorded by
                              </label>
                              <input
                                id={`st-act-by-${row.id}`}
                                value={row.recordedBy}
                                onChange={(e) => updateActivity(member.id, row.id, { recordedBy: e.target.value })}
                                className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                                placeholder="Manager name or ID"
                              />
                            </div>
                            <div>
                              <label
                                className="block text-xs font-medium text-neutral-400"
                                htmlFor={`st-act-notes-${row.id}`}
                              >
                                Notes (BI / refs)
                              </label>
                              <input
                                id={`st-act-notes-${row.id}`}
                                value={row.notes}
                                onChange={(e) => updateActivity(member.id, row.id, { notes: e.target.value })}
                                className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                                placeholder="Tags, ticket #, branch ref…"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
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
