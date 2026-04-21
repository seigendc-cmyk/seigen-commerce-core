"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DashboardTopBar } from "@/components/dashboard/dashboard-top-bar";
import { useVendorStaff } from "@/modules/dashboard/settings/staff/vendor-staff-context";
import { useVendorRoles } from "@/modules/dashboard/settings/roles/vendor-roles-context";
import { getActiveStaffId, setActiveStaffId } from "@/modules/desk/services/sysadmin-bootstrap";
import { getDeskProfileByStaffId } from "@/modules/desk/services/desk-profiles-store";
import { listNotificationsForDesk } from "@/modules/desk/services/notification-service";
import { listEscalations, listMyRequests, listPendingForRole, listPendingForStaff, listPendingApprovals } from "@/modules/desk/services/approval-engine";
import { listDeskAuditEvents } from "@/modules/desk/services/desk-audit";
import { DeskSummaryCards } from "@/modules/desk/ui/desk-summary-cards";
import { PendingApprovalsPanel } from "@/modules/desk/ui/pending-approvals-panel";
import { MyRequestsPanel } from "@/modules/desk/ui/my-requests-panel";
import { NotificationsPanel } from "@/modules/desk/ui/notifications-panel";
import { CriticalAlertsPanel } from "@/modules/desk/ui/critical-alerts-panel";
import { EscalationsPanel } from "@/modules/desk/ui/escalations-panel";
import { ApprovalDetailDrawer } from "@/modules/desk/ui/approval-detail-drawer";
import type { ApprovalRequest } from "@/modules/desk/types/approval";
import { DESK_APPROVALS_UPDATED, DESK_AUDIT_UPDATED, DESK_NOTIFICATIONS_UPDATED, DESK_PROFILES_UPDATED } from "@/modules/desk/services/desk-events";

export function VendorDeskPage() {
  const { staffMembers } = useVendorStaff();
  const { roles } = useVendorRoles();
  const [tick, setTick] = useState(0);
  const [openApprovalId, setOpenApprovalId] = useState<string | null>(null);

  useEffect(() => {
    const onAny = () => setTick((t) => t + 1);
    window.addEventListener(DESK_NOTIFICATIONS_UPDATED, onAny);
    window.addEventListener(DESK_APPROVALS_UPDATED, onAny);
    window.addEventListener(DESK_AUDIT_UPDATED, onAny);
    window.addEventListener(DESK_PROFILES_UPDATED, onAny);
    window.addEventListener("storage", onAny);
    return () => {
      window.removeEventListener(DESK_NOTIFICATIONS_UPDATED, onAny);
      window.removeEventListener(DESK_APPROVALS_UPDATED, onAny);
      window.removeEventListener(DESK_AUDIT_UPDATED, onAny);
      window.removeEventListener(DESK_PROFILES_UPDATED, onAny);
      window.removeEventListener("storage", onAny);
    };
  }, []);

  const activeStaffId = useMemo(() => getActiveStaffId() ?? staffMembers[0]?.id ?? null, [tick, staffMembers]);
  const activeStaff = useMemo(() => staffMembers.find((s) => s.id === activeStaffId) ?? null, [staffMembers, activeStaffId]);
  const role = useMemo(
    () => (activeStaff?.assignedRoleId ? roles.find((r) => r.id === activeStaff.assignedRoleId) : null),
    [activeStaff?.assignedRoleId, roles],
  );

  const profile = useMemo(() => {
    void tick;
    return activeStaff ? getDeskProfileByStaffId(activeStaff.id) : undefined;
  }, [activeStaff?.id, tick]);

  const isTerminalOnly = profile?.isTerminalOnly ?? false;
  const hasDesk = profile?.hasDesk ?? false;
  const isSysAdmin = profile?.deskKind === "sysadmin";

  const actorLabel = activeStaff ? `${activeStaff.firstName} ${activeStaff.lastName}`.trim() || activeStaff.email || "Staff" : "Staff";
  const branchScope = profile?.branchScope ?? (activeStaff ? [activeStaff.branchId] : []);

  const approvalsForMe = useMemo(() => {
    void tick;
    if (!activeStaff) return [] as ApprovalRequest[];
    const byStaff = listPendingForStaff({ staffId: activeStaff.id, isSysAdmin });
    const byRole = role ? listPendingForRole({ roleId: role.id, isSysAdmin }) : [];
    const merged = new Map<string, ApprovalRequest>();
    for (const r of [...byStaff, ...byRole]) merged.set(r.id, r);
    // sysadmin: show all pending
    if (isSysAdmin) for (const r of listPendingApprovals()) merged.set(r.id, r);
    return Array.from(merged.values());
  }, [activeStaff?.id, role?.id, isSysAdmin, tick]);

  const myRequests = useMemo(() => {
    void tick;
    if (!activeStaff) return [];
    return listMyRequests(activeStaff.id);
  }, [activeStaff?.id, tick]);

  const notifications = useMemo(() => {
    void tick;
    if (!activeStaff) return [];
    return listNotificationsForDesk({
      staffId: activeStaff.id,
      roleId: role?.id ?? "",
      branchScope: branchScope === "all" ? "all" : branchScope,
      isSysAdmin,
    });
  }, [activeStaff?.id, role?.id, isSysAdmin, tick]);

  const escalations = useMemo(() => {
    void tick;
    return isSysAdmin ? listEscalations() : [];
  }, [isSysAdmin, tick]);

  const audit = useMemo(() => {
    void tick;
    return isSysAdmin ? listDeskAuditEvents(40) : [];
  }, [isSysAdmin, tick]);

  const openApproval = useMemo(() => {
    if (!openApprovalId) return null;
    const all = [...approvalsForMe, ...myRequests];
    return all.find((r) => r.id === openApprovalId) ?? null;
  }, [openApprovalId, approvalsForMe, myRequests]);

  return (
    <>
      <DashboardTopBar title="Desk" subtitle="Role-based notifications, approvals, escalations, and audit trail." />
      <div className="flex-1 space-y-6 px-4 py-6 sm:px-6">
        <section className="vc-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-heading text-sm font-semibold text-slate-900">Active staff</div>
              <div className="mt-1 text-xs text-slate-600">
                Local-first staff selection for the vendor desk. Later this maps to Supabase user identity.
              </div>
            </div>
            <div className="min-w-[260px]">
              <select
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/25"
                value={activeStaffId ?? ""}
                onChange={(e) => {
                  const v = e.target.value || null;
                  setActiveStaffId(v);
                  setTick((t) => t + 1);
                }}
              >
                {staffMembers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {`${s.firstName} ${s.lastName}`.trim() || s.email || s.id} · {s.assignedRoleId || "no role"}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {activeStaff && isTerminalOnly ? (
          <section className="vc-card-accent-teal">
            <h2 className="font-heading text-base font-semibold text-slate-900">Terminal-only account</h2>
            <p className="mt-2 text-sm text-slate-600">
              This account uses terminal work surfaces and does not have a management desk.
            </p>
          </section>
        ) : null}

        {activeStaff && hasDesk ? (
          <>
            <DeskSummaryCards approvals={approvalsForMe} notifications={notifications} escalations={escalations} />
            <div className="grid gap-6 lg:grid-cols-2">
              <PendingApprovalsPanel
                approvals={approvalsForMe}
                actorStaffId={activeStaff.id}
                actorLabel={actorLabel}
                onOpen={(id) => setOpenApprovalId(id)}
              />
              <NotificationsPanel staffId={activeStaff.id} actorLabel={actorLabel} notifications={notifications} />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <MyRequestsPanel requests={myRequests} />
              <CriticalAlertsPanel notifications={notifications} />
            </div>

            {isSysAdmin ? (
              <section className="vc-card-accent-teal">
                <h2 className="font-heading text-base font-semibold text-slate-900">Governance &amp; security</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Role matrix, user access, permission registry, and governance audit trail. Requires{" "}
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800">
                    desk.sysadmin.access
                  </code>{" "}
                  and related permissions; some writes still need Owner/Admin at the database layer (RLS).
                </p>
                <div className="mt-4">
                  <Link href="/dashboard/desk/security/roles" className="vc-btn-primary inline-flex">
                    Open Role &amp; permissions console
                  </Link>
                </div>
              </section>
            ) : null}

            {isSysAdmin ? (
              <div className="grid gap-6 lg:grid-cols-2">
                <EscalationsPanel escalations={escalations} />
                <section className="vc-card">
                  <h2 className="font-heading text-base font-semibold text-slate-900">Recent audit activity</h2>
                  <p className="mt-1 text-sm text-slate-600">Immutable trail of decisions and desk actions.</p>
                  {audit.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500">No audit events yet.</p>
                  ) : (
                    <ul className="mt-4 space-y-2">
                      {audit.map((e) => (
                        <li key={e.id} className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="font-semibold text-slate-900">{e.action}</div>
                            <div className="font-mono text-xs text-slate-500">
                              {new Date(e.occurredAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                            </div>
                          </div>
                          <div className="mt-0.5 text-xs text-slate-600">
                            {e.moduleKey} · {e.actorLabel} · {e.entityType ?? "—"} · {e.entityId ?? "—"}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            ) : null}
          </>
        ) : null}

        {!activeStaff ? (
          <section className="vc-card">
            <h2 className="font-heading text-base font-semibold text-slate-900">No staff found</h2>
            <p className="mt-2 text-sm text-slate-600">Add staff in Settings to begin.</p>
          </section>
        ) : null}
      </div>

      <ApprovalDetailDrawer open={openApprovalId != null} request={openApproval} onClose={() => setOpenApprovalId(null)} />
    </>
  );
}

