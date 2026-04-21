"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useVendorBranches } from "@/modules/dashboard/settings/branches/vendor-branches-context";
import { useVendorRoles } from "@/modules/dashboard/settings/roles/vendor-roles-context";
import { readVendorCore, writeVendorCore } from "@/modules/dashboard/settings/vendor-core-storage";
import {
  emptyActivityRow,
  emptyEmploymentRow,
  emptyStaffMember,
  type PreviousEmploymentRow,
  type StaffActivityRow,
  type StaffMember,
} from "@/modules/dashboard/settings/staff/staff-types";
import { computeDeskEligibilityForRole } from "@/modules/desk/services/desk-eligibility";
import { upsertDeskProfile } from "@/modules/desk/services/desk-profiles-store";
import {
  ensureSeigenSupportStaff,
  ensureSysAdminStaff,
  getActiveStaffId,
  SEIGEN_SUPPORT_STAFF_ID,
  SYSADMIN_STAFF_ID,
  setActiveStaffId,
} from "@/modules/desk/services/sysadmin-bootstrap";
import { applyStartupStaffAccessCodesIfNeededSync } from "@/modules/dashboard/settings/staff/staff-access-codes";

type VendorStaffContextValue = {
  staffMembers: StaffMember[];
  updateStaff: (staffId: string, patch: Partial<StaffMember>) => void;
  addStaff: () => void;
  removeStaff: (staffId: string) => void;
  expandedStaffId: string | null;
  setExpandedStaffId: (id: string | null) => void;
  updateJob: (staffId: string, jobId: string, patch: Partial<Omit<PreviousEmploymentRow, "id">>) => void;
  addJob: (staffId: string) => void;
  removeJob: (staffId: string, jobId: string) => void;
  updateActivity: (staffId: string, activityId: string, patch: Partial<Omit<StaffActivityRow, "id">>) => void;
  addActivity: (staffId: string) => void;
  removeActivity: (staffId: string, activityId: string) => void;
};

const VendorStaffContext = createContext<VendorStaffContextValue | null>(null);

export function VendorStaffProvider({ children }: { children: ReactNode }) {
  const { branches } = useVendorBranches();
  const { roles } = useVendorRoles();
  const staffListId = useId();
  const nextStaffSeq = useRef(1);
  const nextEmploymentSeq = useRef<Record<string, number>>({});
  const nextActivitySeq = useRef<Record<string, number>>({});

  const defaultBranchId = branches[0]?.id ?? "";

  const [staffMembers, setStaffMembers] = useState<StaffMember[]>(() => {
    const stored = readVendorCore<StaffMember[]>("staff", []);
    const seeded = stored.length > 0 ? stored : [emptyStaffMember(`${staffListId}-s0`, defaultBranchId)];
    const withSys = ensureSysAdminStaff(seeded, defaultBranchId);
    const withBoot = ensureSeigenSupportStaff(withSys, defaultBranchId);
    const needsPersist =
      stored.length === 0 ||
      withBoot.length !== stored.length ||
      !stored.some((s) => s.id === SYSADMIN_STAFF_ID) ||
      !stored.some((s) => s.id === SEIGEN_SUPPORT_STAFF_ID);
    if (needsPersist) writeVendorCore("staff", withBoot);
    if (!getActiveStaffId()) setActiveStaffId(withBoot[0]?.id ?? null);
    applyStartupStaffAccessCodesIfNeededSync();
    return withBoot;
  });
  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null);

  useEffect(() => {
    const ids = new Set(branches.map((b) => b.id));
    if (ids.size === 0) return;
    setStaffMembers((rows) =>
      rows.map((m) => (ids.has(m.branchId) ? m : { ...m, branchId: branches[0]!.id })),
    );
  }, [branches]);

  const updateStaff = useCallback((staffId: string, patch: Partial<StaffMember>) => {
    setStaffMembers((rows) => {
      const next = rows.map((r) => (r.id === staffId ? { ...r, ...patch } : r));
      writeVendorCore("staff", next);
      return next;
    });
  }, []);

  const addStaff = useCallback(() => {
    const n = nextStaffSeq.current++;
    const id = `${staffListId}-s${n}`;
    const branchId = branches[0]?.id ?? "";
    nextEmploymentSeq.current[id] = 1;
    nextActivitySeq.current[id] = 1;
    setStaffMembers((rows) => {
      const next = [...rows, emptyStaffMember(id, branchId)];
      writeVendorCore("staff", next);
      return next;
    });
    setExpandedStaffId(id);
  }, [staffListId, branches]);

  const removeStaff = useCallback((staffId: string) => {
    if (staffId === SYSADMIN_STAFF_ID || staffId === SEIGEN_SUPPORT_STAFF_ID) return;
    setStaffMembers((rows) => {
      const next = rows.length <= 1 ? rows : rows.filter((r) => r.id !== staffId);
      writeVendorCore("staff", next);
      return next;
    });
    setExpandedStaffId((cur) => (cur === staffId ? null : cur));
  }, []);

  const updateJob = useCallback((staffId: string, jobId: string, patch: Partial<Omit<StaffMember["previousJobs"][number], "id">>) => {
    setStaffMembers((rows) =>
      rows.map((m) =>
        m.id !== staffId
          ? m
          : {
              ...m,
              previousJobs: m.previousJobs.map((r) => (r.id === jobId ? { ...r, ...patch } : r)),
            },
      ),
    );
  }, []);

  const addJob = useCallback((staffId: string) => {
    setStaffMembers((rows) =>
      rows.map((m) => {
        if (m.id !== staffId) return m;
        const seq = nextEmploymentSeq.current[staffId] ?? 1;
        const n = seq;
        nextEmploymentSeq.current[staffId] = n + 1;
        return {
          ...m,
          previousJobs: [...m.previousJobs, emptyEmploymentRow(`${staffId}-e${n}`)],
        };
      }),
    );
  }, []);

  const removeJob = useCallback((staffId: string, jobId: string) => {
    setStaffMembers((rows) =>
      rows.map((m) => {
        if (m.id !== staffId) return m;
        if (m.previousJobs.length <= 1) return m;
        return { ...m, previousJobs: m.previousJobs.filter((r) => r.id !== jobId) };
      }),
    );
  }, []);

  const updateActivity = useCallback(
    (staffId: string, activityId: string, patch: Partial<Omit<StaffMember["activityLog"][number], "id">>) => {
      setStaffMembers((rows) =>
        rows.map((m) =>
          m.id !== staffId
            ? m
            : {
                ...m,
                activityLog: m.activityLog.map((r) => (r.id === activityId ? { ...r, ...patch } : r)),
              },
        ),
      );
    },
    [],
  );

  const addActivity = useCallback((staffId: string) => {
    setStaffMembers((rows) =>
      rows.map((m) => {
        if (m.id !== staffId) return m;
        const seq = nextActivitySeq.current[staffId] ?? 1;
        const n = seq;
        nextActivitySeq.current[staffId] = n + 1;
        return {
          ...m,
          activityLog: [...m.activityLog, emptyActivityRow(`${staffId}-a${n}`)],
        };
      }),
    );
  }, []);

  const removeActivity = useCallback((staffId: string, activityId: string) => {
    setStaffMembers((rows) =>
      rows.map((m) => {
        if (m.id !== staffId) return m;
        if (m.activityLog.length <= 1) return m;
        return { ...m, activityLog: m.activityLog.filter((r) => r.id !== activityId) };
      }),
    );
  }, []);

  useEffect(() => {
    setStaffMembers((rows) =>
      rows.map((m) => {
        if (!m.assignedRoleId) return m;
        if (roles.some((r) => r.id === m.assignedRoleId)) return m;
        return { ...m, assignedRoleId: "" };
      }),
    );
  }, [roles]);

  useEffect(() => {
    // Auto-create/refresh desk profiles based on staff + role eligibility.
    for (const m of staffMembers) {
      const role = m.assignedRoleId ? roles.find((r) => r.id === m.assignedRoleId) : undefined;
      const elig = computeDeskEligibilityForRole(role);
      const roleNameSnapshot = role?.name?.trim() ? role.name.trim() : m.assignedRoleId ? "Role" : "Unassigned";
      upsertDeskProfile({
        staffId: m.id,
        tenantId: null,
        branchScope: elig.deskKind === "sysadmin" ? "all" : [m.branchId],
        roleId: m.assignedRoleId || "",
        roleNameSnapshot,
        hasDesk: elig.hasDesk,
        deskKind: elig.deskKind,
        isTerminalOnly: elig.isTerminalOnly,
      });
    }
  }, [staffMembers, roles]);

  const value = useMemo(
    () => ({
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
    }),
    [
      staffMembers,
      updateStaff,
      addStaff,
      removeStaff,
      expandedStaffId,
      updateJob,
      addJob,
      removeJob,
      updateActivity,
      addActivity,
      removeActivity,
    ],
  );

  return <VendorStaffContext.Provider value={value}>{children}</VendorStaffContext.Provider>;
}

export function useVendorStaff(): VendorStaffContextValue {
  const ctx = useContext(VendorStaffContext);
  if (!ctx) throw new Error("useVendorStaff must be used within VendorStaffProvider");
  return ctx;
}
