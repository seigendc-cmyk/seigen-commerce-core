"use client";

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { emptyShopBranch, type DayHours, type ShopBranch, type Weekday } from "./branch-types";

type VendorBranchesContextValue = {
  branches: ShopBranch[];
  updateBranch: (id: string, patch: Partial<ShopBranch>) => void;
  updateBranchHours: (branchId: string, day: Weekday, patch: Partial<DayHours>) => void;
  addBranch: () => string;
  removeBranch: (id: string) => void;
  expandedBranchId: string | null;
  setExpandedBranchId: (id: string | null) => void;
};

const VendorBranchesContext = createContext<VendorBranchesContextValue | null>(null);

export function VendorBranchesProvider({ children }: { children: ReactNode }) {
  const root = useId();
  const nextSeq = useRef(1);

  const [branches, setBranches] = useState<ShopBranch[]>(() => [emptyShopBranch(`${root}-b0`)]);
  const [expandedBranchId, setExpandedBranchId] = useState<string | null>(null);

  const updateBranch = useCallback((id: string, patch: Partial<ShopBranch>) => {
    setBranches((rows) => rows.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }, []);

  const updateBranchHours = useCallback((branchId: string, day: Weekday, patch: Partial<DayHours>) => {
    setBranches((rows) =>
      rows.map((b) => {
        if (b.id !== branchId) return b;
        return {
          ...b,
          businessHours: {
            ...b.businessHours,
            [day]: { ...b.businessHours[day], ...patch },
          },
        };
      }),
    );
  }, []);

  const addBranch = useCallback((): string => {
    const id = `${root}-b${nextSeq.current++}`;
    setBranches((rows) => [...rows, emptyShopBranch(id)]);
    setExpandedBranchId(id);
    return id;
  }, [root]);

  const removeBranch = useCallback((id: string) => {
    setBranches((rows) => (rows.length <= 1 ? rows : rows.filter((b) => b.id !== id)));
    setExpandedBranchId((cur) => (cur === id ? null : cur));
  }, []);

  const value = useMemo(
    () => ({
      branches,
      updateBranch,
      updateBranchHours,
      addBranch,
      removeBranch,
      expandedBranchId,
      setExpandedBranchId,
    }),
    [branches, updateBranch, updateBranchHours, addBranch, removeBranch, expandedBranchId],
  );

  return <VendorBranchesContext.Provider value={value}>{children}</VendorBranchesContext.Provider>;
}

export function useVendorBranches(): VendorBranchesContextValue {
  const ctx = useContext(VendorBranchesContext);
  if (!ctx) throw new Error("useVendorBranches must be used within VendorBranchesProvider");
  return ctx;
}
