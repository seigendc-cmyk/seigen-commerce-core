import { readDemoSession } from "@/lib/demo-session";
import { getPlanById } from "@/lib/plans";
import { listProductReadModels } from "@/modules/inventory/services/product-read-model";
import { listSales } from "@/modules/pos/services/sales-service";
import type { ExecutiveSnapshot } from "../types/executive";

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function readExecutiveSnapshot(): ExecutiveSnapshot {
  const generatedAt = new Date().toISOString();

  const demoSession = readDemoSession();
  const plan = demoSession ? (getPlanById(demoSession.planId) ?? null) : null;

  const products = listProductReadModels();
  const totalProducts = products.length;
  const totalStockOnHand = products.reduce((acc, p) => acc + (Number.isFinite(p.onHandQty) ? p.onHandQty : 0), 0);

  const sales = listSales();
  const totalSalesCount = sales.length;
  const totalSalesValue = roundMoney(
    sales.reduce((acc, s) => acc + (Number.isFinite(s.subtotal) ? s.subtotal : 0), 0),
  );
  const latestReceiptNumber = sales[0]?.receiptNumber ?? null;

  return {
    generatedAt,
    demoSession,
    plan,
    commercial: {
      planId: demoSession?.planId ?? null,
      planName: plan?.name ?? null,
      monthlyPriceLabel: plan?.monthlyPriceLabel ?? null,
      includedModules: plan?.includedModules ?? [],
    },
    inventory: {
      totalProducts,
      totalStockOnHand,
    },
    pos: {
      totalSalesCount,
      totalSalesValue,
      latestReceiptNumber,
    },
    readinessNotes: [
      {
        title: "Data provenance",
        status: "real",
        detail: "All metrics are aggregated from local browser storage (sessionStorage + localStorage).",
      },
      {
        title: "Entitlements & roles",
        status: "placeholder",
        detail: "Executive access control will be backed by platform roles/claims when a backend is introduced.",
      },
      {
        title: "Audit trail",
        status: "placeholder",
        detail: "Immutable event logs (sales, inventory adjustments, plan changes) will land with server persistence.",
      },
      {
        title: "Reporting / BI",
        status: "placeholder",
        detail: "No BI engine yet. Future: daily rollups, exports, and governance KPIs.",
      },
    ],
  };
}

