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
import { readVendorCore, writeVendorCore } from "@/modules/dashboard/settings/vendor-core-storage";
import { mergeInventoryBranchesIntoVendorBranches } from "@/modules/dashboard/settings/branches/vendor-branches-sync";

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

  const [branches, setBranches] = useState<ShopBranch[]>(() => {
    // Start with any saved branches and also ensure InventoryRepo branches are present
    // (e.g., consignment stalls created as branches).
    const merged = mergeInventoryBranchesIntoVendorBranches();
    if (merged.length > 0) return merged;
    const seeded = [emptyShopBranch(`${root}-b0`)];
    writeVendorCore("branches", seeded);
    return seeded;
  });
  const [expandedBranchId, setExpandedBranchId] = useState<string | null>(null);

  const updateBranch = useCallback((id: string, patch: Partial<ShopBranch>) => {
    setBranches((rows) => {
      const next = rows.map((b) => (b.id === id ? { ...b, ...patch } : b));
      writeVendorCore("branches", next);
      return next;
    });
  }, []);

  const updateBranchHours = useCallback((branchId: string, day: Weekday, patch: Partial<DayHours>) => {
    setBranches((rows) => {
      const next = rows.map((b) => {
        if (b.id !== branchId) return b;
        return {
          ...b,
          businessHours: {
            ...b.businessHours,
            [day]: { ...b.businessHours[day], ...patch },
          },
        };
      });
      writeVendorCore("branches", next);
      return next;
    });
  }, []);

  const addBranch = useCallback((): string => {
    const id = `${root}-b${nextSeq.current++}`;
    setBranches((rows) => {
      const next = [...rows, emptyShopBranch(id)];
      writeVendorCore("branches", next);
      return next;
    });
    setExpandedBranchId(id);
    return id;
  }, [root]);

  const removeBranch = useCallback((id: string) => {
    setBranches((rows) => {
      const next = rows.length <= 1 ? rows : rows.filter((b) => b.id !== id);
      writeVendorCore("branches", next);
      return next;
    });
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
