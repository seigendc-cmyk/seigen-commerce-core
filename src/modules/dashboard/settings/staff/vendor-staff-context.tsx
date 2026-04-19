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
import {
  emptyActivityRow,
  emptyEmploymentRow,
  emptyStaffMember,
  type PreviousEmploymentRow,
  type StaffActivityRow,
  type StaffMember,
} from "@/modules/dashboard/settings/staff/staff-types";

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

  const [staffMembers, setStaffMembers] = useState<StaffMember[]>(() => [
    emptyStaffMember(`${staffListId}-s0`, defaultBranchId),
  ]);
  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null);

  useEffect(() => {
    const ids = new Set(branches.map((b) => b.id));
    if (ids.size === 0) return;
    setStaffMembers((rows) =>
      rows.map((m) => (ids.has(m.branchId) ? m : { ...m, branchId: branches[0]!.id })),
    );
  }, [branches]);

  const updateStaff = useCallback((staffId: string, patch: Partial<StaffMember>) => {
    setStaffMembers((rows) => rows.map((r) => (r.id === staffId ? { ...r, ...patch } : r)));
  }, []);

  const addStaff = useCallback(() => {
    const n = nextStaffSeq.current++;
    const id = `${staffListId}-s${n}`;
    const branchId = branches[0]?.id ?? "";
    nextEmploymentSeq.current[id] = 1;
    nextActivitySeq.current[id] = 1;
    setStaffMembers((rows) => [...rows, emptyStaffMember(id, branchId)]);
    setExpandedStaffId(id);
  }, [staffListId, branches]);

  const removeStaff = useCallback((staffId: string) => {
    setStaffMembers((rows) => (rows.length <= 1 ? rows : rows.filter((r) => r.id !== staffId)));
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
