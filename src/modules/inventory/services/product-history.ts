import { listStockAdjustmentEntries } from "@/modules/financial/services/stock-adjustment-ledger";
import { listSales } from "@/modules/pos/services/sales-service";
import type { Id } from "@/modules/inventory/types/models";
import { InventoryRepo } from "./inventory-repo";
import { PurchasingService } from "./purchasing-service";
import { ReceivingService } from "./receiving-service";

export type ProductHistoryFilters = {
  /** Inclusive YYYY-MM-DD */
  fromDate?: string;
  /** Inclusive YYYY-MM-DD */
  toDate?: string;
  /** Branch id or `all` */
  branchId?: Id | "all";
};

export type ProductHistoryKind = "sale" | "stock_adjustment" | "purchase_order" | "goods_receipt";

export type ProductHistoryRow = {
  id: string;
  at: string;
  branchId: Id;
  branchName: string;
  kind: ProductHistoryKind;
  title: string;
  detail: string;
  /** Stock movement: negative = out, positive = in */
  qtyDelta: number | null;
  /** Line or economic amount where applicable */
  amount: number | null;
  ref: string;
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function branchName(id: Id): string {
  return InventoryRepo.getBranch(id)?.name?.trim() || id;
}

/** Compare YYYY-MM-DD portion of ISO timestamp to filter range. */
function isoInDateRange(iso: string, from?: string, to?: string): boolean {
  const day = iso.slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

function branchMatches(rowBranch: Id, filter: Id | "all" | undefined): boolean {
  if (!filter || filter === "all") return true;
  return rowBranch === filter;
}

/**
 * Unified timeline: POS sales, stocktake adjustments, purchase orders, and goods receipts
 * for one product. Sorted newest first.
 */
export function buildProductHistory(productId: Id, f: ProductHistoryFilters = {}): ProductHistoryRow[] {
  const rows: ProductHistoryRow[] = [];

  for (const sale of listSales()) {
    if (sale.status !== "completed") continue;
    if (!branchMatches(sale.branchId, f.branchId)) continue;
    for (const line of sale.lines) {
      if (line.productId !== productId) continue;
      if (!isoInDateRange(sale.createdAt, f.fromDate, f.toDate)) continue;
      rows.push({
        id: `sale_${sale.id}_${line.productId}`,
        at: sale.createdAt,
        branchId: sale.branchId,
        branchName: branchName(sale.branchId),
        kind: "sale",
        title: "POS sale",
        detail: `Receipt ${sale.receiptNumber} · ${line.qty} ${line.unit} @ ${line.unitPrice.toFixed(2)}`,
        qtyDelta: -line.qty,
        amount: roundMoney(line.lineTotal),
        ref: sale.receiptNumber,
      });
    }
  }

  for (const adj of listStockAdjustmentEntries(800)) {
    if (adj.productId !== productId) continue;
    if (!branchMatches(adj.branchId, f.branchId)) continue;
    if (!isoInDateRange(adj.createdAt, f.fromDate, f.toDate)) continue;
    rows.push({
      id: `adj_${adj.id}`,
      at: adj.createdAt,
      branchId: adj.branchId,
      branchName: branchName(adj.branchId),
      kind: "stock_adjustment",
      title: "Stock adjustment",
      detail: adj.memo || "Variance at standard cost",
      qtyDelta: adj.qtyVariance,
      amount: adj.valueImpact,
      ref: adj.reference?.trim() || adj.stocktakeId.slice(-12),
    });
  }

  for (const po of PurchasingService.listPurchaseOrders()) {
    if (po.status === "draft" || po.status === "cancelled") continue;
    if (!branchMatches(po.branchId, f.branchId)) continue;
    const line = po.items.find((it) => it.productId === productId);
    if (!line) continue;
    const at = po.updatedAt || po.createdAt;
    if (!isoInDateRange(at, f.fromDate, f.toDate)) continue;
    const ref = po.reference?.trim() || po.id.slice(-10);
    rows.push({
      id: `po_${po.id}_${line.id}`,
      at,
      branchId: po.branchId,
      branchName: branchName(po.branchId),
      kind: "purchase_order",
      title: "Purchase order",
      detail: `Ordered ${line.orderedQty} · est ${line.expectedUnitCost.toFixed(2)} · ${po.status.replace(/_/g, " ")} · ${po.paymentTerms === "credit" ? "Credit" : "Cash"}`,
      qtyDelta: line.orderedQty,
      amount: roundMoney(line.orderedQty * line.expectedUnitCost),
      ref,
    });
  }

  for (const gr of ReceivingService.listReceipts()) {
    if (!branchMatches(gr.branchId, f.branchId)) continue;
    const item = gr.items.find((it) => it.productId === productId);
    if (!item) continue;
    const at = gr.receivedAt || gr.createdAt;
    if (!isoInDateRange(at, f.fromDate, f.toDate)) continue;
    rows.push({
      id: `gr_${gr.id}_${item.id}`,
      at,
      branchId: gr.branchId,
      branchName: branchName(gr.branchId),
      kind: "goods_receipt",
      title: "Goods receipt",
      detail: `Received ${item.receivedQty} @ ${item.unitCost.toFixed(2)} · PO ${gr.purchaseOrderId.slice(-10)}`,
      qtyDelta: item.receivedQty,
      amount: roundMoney(item.receivedQty * item.unitCost),
      ref: gr.id.slice(-12),
    });
  }

  rows.sort((a, b) => b.at.localeCompare(a.at));
  return rows;
}
