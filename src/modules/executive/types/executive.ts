import type { CommercialPlan, PlanModule } from "@/lib/plans";
import type { DemoVendorSession } from "@/lib/demo-session";

export type ExecutiveSnapshot = {
  generatedAt: string;
  demoSession: DemoVendorSession | null;
  plan: CommercialPlan | null;
  commercial: {
    planId: string | null;
    planName: string | null;
    monthlyPriceLabel: string | null;
    includedModules: readonly PlanModule[];
  };
  inventory: {
    totalProducts: number;
    totalStockOnHand: number;
  };
  pos: {
    totalSalesCount: number;
    totalSalesValue: number;
    latestReceiptNumber: string | null;
  };
  readinessNotes: Array<{ title: string; status: "real" | "placeholder"; detail: string }>;
};

