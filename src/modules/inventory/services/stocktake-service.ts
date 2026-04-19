import { landUnitCostFromProduct } from "@/modules/financial/lib/cogs-cost";
import { postStockAdjustmentJournalFromLines } from "@/modules/financial/services/stock-adjustment-journal-posting";
import { appendStockAdjustmentEntries } from "@/modules/financial/services/stock-adjustment-ledger";
import type { Id } from "@/modules/inventory/types/models";
import { InventoryRepo } from "./inventory-repo";
import { browserLocalJson } from "./storage";

const NS = { namespace: "seigen.inventory", version: 1 as const };
const SESSION_KEY = "stocktake_sessions";

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function uid(p: string): Id {
  return `${p}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

export type StocktakePostedLine = {
  productId: string;
  sku: string;
  name: string;
  systemQty: number;
  countedQty: number;
  qtyVariance: number;
  unitCost: number;
  valueImpact: number;
};

export type StocktakeSession = {
  id: string;
  branchId: string;
  createdAt: string;
  memo: string;
  lines: StocktakePostedLine[];
};

type SessionDb = { sessions: StocktakeSession[] };

function getSessionDb(): SessionDb {
  const store = browserLocalJson(NS);
  if (!store) return { sessions: [] };
  return store.read<SessionDb>(SESSION_KEY, { sessions: [] });
}

function setSessionDb(db: SessionDb) {
  const store = browserLocalJson(NS);
  if (!store) return;
  store.write(SESSION_KEY, db);
}

export function stocktakeSessionsStorageKey(): string {
  const store = browserLocalJson(NS);
  return store?.fullKey(SESSION_KEY) ?? "seigen.inventory:v1:stocktake_sessions";
}

export function listStocktakeSessions(limit = 50): StocktakeSession[] {
  return getSessionDb()
    .sessions.slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export type PostStocktakeInput = {
  branchId: string;
  memo: string;
  /** Products with a physical count this run (integer ≥ 0). */
  counts: { productId: string; countedQty: number }[];
};

export type PostStocktakeResult =
  | { ok: true; session: StocktakeSession }
  | { ok: false; error: string };

/**
 * Applies counted quantities: updates branch stock and posts inventory / P&L adjustment lines at standard cost.
 */
export function postStocktake(input: PostStocktakeInput): PostStocktakeResult {
  const memo = input.memo.trim();
  if (input.counts.length === 0) {
    return { ok: false, error: "Add at least one counted line." };
  }

  const sessionId = uid("st");
  const lines: StocktakePostedLine[] = [];
  const ledgerRows: Parameters<typeof appendStockAdjustmentEntries>[0] = [];

  for (const c of input.counts) {
    const counted = Math.floor(Number(c.countedQty));
    if (!Number.isFinite(counted) || counted < 0) {
      return { ok: false, error: "Counted quantities must be whole numbers ≥ 0." };
    }
    const product = InventoryRepo.getProduct(c.productId);
    if (!product) continue;

    const systemQty = InventoryRepo.getStock(input.branchId, c.productId)?.onHandQty ?? 0;
    const qtyVariance = counted - systemQty;
    if (qtyVariance === 0) continue;

    const unitCost = landUnitCostFromProduct(product);
    const valueImpact = roundMoney(qtyVariance * unitCost);

    lines.push({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      systemQty,
      countedQty: counted,
      qtyVariance,
      unitCost,
      valueImpact,
    });

    ledgerRows.push({
      branchId: input.branchId,
      stocktakeId: sessionId,
      reference: `ST-${sessionId.slice(-12)}`,
      productId: product.id,
      sku: product.sku,
      name: product.name,
      qtyVariance,
      unitCost,
      valueImpact,
      memo: memo || "Stocktake adjustment",
      adjustmentKind: "physical_count",
    });
  }

  if (lines.length === 0) {
    return {
      ok: false,
      error:
        "No inventory adjustments to post — counts match system quantities, products were not found, or every variance was zero.",
    };
  }

  const createdAt = new Date().toISOString();

  const jr = postStockAdjustmentJournalFromLines(
    sessionId,
    memo || "Stocktake",
    lines.map((l) => ({ valueImpact: l.valueImpact })),
  );
  if (!jr.ok) {
    return { ok: false, error: jr.error };
  }

  for (const ln of lines) {
    InventoryRepo.incrementStock(input.branchId, ln.productId, ln.qtyVariance);
  }

  appendStockAdjustmentEntries(ledgerRows);

  const session: StocktakeSession = {
    id: sessionId,
    branchId: input.branchId,
    createdAt,
    memo: memo || "Stocktake",
    lines,
  };

  const db = getSessionDb();
  db.sessions.unshift(session);
  setSessionDb(db);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("seigen-stocktake-posted", { detail: { sessionId } }));
  }

  return { ok: true, session };
}
