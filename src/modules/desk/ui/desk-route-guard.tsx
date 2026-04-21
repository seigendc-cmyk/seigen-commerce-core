"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useVendorStaff } from "@/modules/dashboard/settings/staff/vendor-staff-context";
import { getActiveStaffId } from "@/modules/desk/services/sysadmin-bootstrap";
import { getDeskProfileByStaffId } from "@/modules/desk/services/desk-profiles-store";
import { VendorDeskPage } from "@/modules/desk/ui/vendor-desk-page";

export function DeskRouteGuard() {
  const { staffMembers } = useVendorStaff();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onAny = () => setTick((t) => t + 1);
    window.addEventListener("storage", onAny);
    window.addEventListener("seigen-desk-profiles-updated", onAny);
    return () => {
      window.removeEventListener("storage", onAny);
      window.removeEventListener("seigen-desk-profiles-updated", onAny);
    };
  }, []);

  const activeStaffId = useMemo(() => getActiveStaffId() ?? staffMembers[0]?.id ?? null, [tick, staffMembers]);
  const profile = useMemo(() => {
    void tick;
    return activeStaffId ? getDeskProfileByStaffId(activeStaffId) : undefined;
  }, [activeStaffId, tick]);

  const denied = Boolean(profile?.isTerminalOnly);

  if (denied) {
    return (
      <div className="flex-1 space-y-6 px-4 py-6 sm:px-6">
        <section className="vendor-panel-soft rounded-2xl p-6">
          <h1 className="text-base font-semibold text-white">Access denied</h1>
          <p className="mt-2 text-sm text-neutral-400">
            This account is configured as <span className="font-semibold text-neutral-200">terminal-only</span> and does
            not have access to the Management Desk (notifications/approvals/escalations).
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/dashboard/pos"
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
            >
              Go to POS
            </Link>
            <Link
              href="/dashboard"
              className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              Go to Overview
            </Link>
          </div>
          <p className="mt-4 text-xs text-neutral-500">
            If this is incorrect, update the role’s desk settings under <span className="font-semibold">Settings → Roles</span>.
          </p>
        </section>
      </div>
    );
  }

  return <VendorDeskPage />;
}

