import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";
import { browserLocalJson } from "@/modules/inventory/services/storage";
import type { Id } from "@/modules/inventory/types/models";
import type { Cart, Payment, Sale, SaleLine, SaleStatus } from "../types/pos";
import { cartAmountDue, computeCartDeliveryFee } from "./delivery-pricing";
import { loadIdeliverProviders } from "./ideliver-repo";
import { recordIdeliverDeliveryCredit } from "./ideliver-ledger";
import { computeCartSaleTax } from "@/modules/financial/lib/pos-sale-tax";
import { recordCogsReservesFromSale } from "@/modules/financial/services/cogs-reserves-ledger";
import { readTaxOnSalesSettings } from "@/modules/financial/services/tax-settings";
import { recordOutputTaxFromSale } from "@/modules/financial/services/tax-ledger";
import { nextReceiptNumber } from "./receipt-number";
import { validateStockForCart } from "./stock-validation";

const NS = { namespace: "seigen.pos", version: 1 as const };

type SalesDb = {
  sales: Sale[];
};

function nowIso() {
  return new Date().toISOString();
}

function uid(prefix: string): Id {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function getDb(): SalesDb {
  const store = browserLocalJson(NS);
  if (!store) return { sales: [] };
  return store.read<SalesDb>("sales", { sales: [] });
}

function setDb(db: SalesDb) {
  const store = browserLocalJson(NS);
  if (!store) return;
  store.write("sales", db);
}

/** Full localStorage key: `seigen.pos:v1:sales` */
export const posSalesStorageKey = (() => {
  const store = browserLocalJson(NS);
  return store?.fullKey("sales") ?? `${NS.namespace}:v${NS.version}:sales`;
})();

/** Phase 1 sales without receiptNumber / status — normalized on read. */
export function normalizeSale(raw: unknown): Sale {
  const s = raw as Partial<Sale> & Record<string, unknown>;
  const receiptNumber =
    typeof s.receiptNumber === "string" && s.receiptNumber.trim().length > 0
      ? s.receiptNumber.trim()
      : `LEGACY-${String(s.id).replace(/[^a-zA-Z0-9]/g, "").slice(-8).toUpperCase()}`;
  const status: SaleStatus = s.status === "voided" ? "voided" : "completed";
  const subtotal = typeof s.subtotal === "number" && Number.isFinite(s.subtotal) ? roundMoney(s.subtotal) : 0;
  const deliveryFee =
    typeof s.deliveryFee === "number" && Number.isFinite(s.deliveryFee) ? roundMoney(s.deliveryFee) : 0;
  const amountDue =
    typeof s.amountDue === "number" && Number.isFinite(s.amountDue)
      ? roundMoney(s.amountDue)
      : roundMoney(subtotal + deliveryFee);

  const fare = s.ideliverFareSource;
  const ideliverFareSource =
    fare === "computed" || fare === "override" || fare === "none" ? fare : deliveryFee > 0 ? "computed" : "none";

  return {
    id: (typeof s.id === "string" && s.id ? s.id : `legacy_${Date.now()}`) as Id,
    receiptNumber,
    status,
    createdAt: typeof s.createdAt === "string" ? s.createdAt : nowIso(),
    branchId: s.branchId as Id,
    lines: Array.isArray(s.lines) ? (s.lines as SaleLine[]) : [],
    subtotal,
    deliveryFee,
    amountDue,
    ideliverProviderId: typeof s.ideliverProviderId === "string" ? s.ideliverProviderId : null,
    ideliverProviderName: typeof s.ideliverProviderName === "string" ? s.ideliverProviderName : null,
    ideliverFareSource,
    payments: Array.isArray(s.payments) ? (s.payments as Payment[]) : [],
    totalPaid: typeof s.totalPaid === "number" ? roundMoney(s.totalPaid) : 0,
    changeDue: typeof s.changeDue === "number" ? roundMoney(s.changeDue) : 0,
    salesTaxAmount:
      typeof s.salesTaxAmount === "number" && Number.isFinite(s.salesTaxAmount)
        ? roundMoney(s.salesTaxAmount)
        : undefined,
    taxableNetBase:
      typeof s.taxableNetBase === "number" && Number.isFinite(s.taxableNetBase)
        ? roundMoney(s.taxableNetBase)
        : undefined,
    taxableGoodsSubtotal:
      typeof s.taxableGoodsSubtotal === "number" && Number.isFinite(s.taxableGoodsSubtotal)
        ? roundMoney(s.taxableGoodsSubtotal)
        : undefined,
    taxRatePercentSnapshot:
      typeof s.taxRatePercentSnapshot === "number" && Number.isFinite(s.taxRatePercentSnapshot)
        ? roundMoney(s.taxRatePercentSnapshot)
        : undefined,
    pricesTaxInclusiveSnapshot:
      typeof s.pricesTaxInclusiveSnapshot === "boolean" ? s.pricesTaxInclusiveSnapshot : undefined,
  };
}

export function listSales(): Sale[] {
  return getDb()
    .sales.map(normalizeSale)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function cartToSaleLines(cart: Cart): SaleLine[] {
  return cart.items.map((i) => ({
    productId: i.productId,
    sku: i.sku,
    name: i.name,
    unit: i.unit,
    unitPrice: i.unitPrice,
    qty: i.qty,
    lineTotal: i.lineTotal,
    taxable: i.taxable,
  }));
}

export function buildSale(
  cart: Cart,
  payment: Payment,
  receiptNumber: string,
  status: SaleStatus = "completed",
): Sale {
  const branch = InventoryRepo.getDefaultBranch();
  const providers = loadIdeliverProviders();
  const goods = roundMoney(cart.subtotal);
  const deliveryFee = computeCartDeliveryFee(cart, providers);
  const tax = computeCartSaleTax(cart, providers);
  const amountDue = tax.amountDue;
  const ts = readTaxOnSalesSettings();

  let ideliverProviderId: string | null = null;
  let ideliverProviderName: string | null = null;
  let ideliverFareSource: Sale["ideliverFareSource"] = "none";

  if (deliveryFee > 0 && cart.delivery.enabled && cart.delivery.providerId) {
    const p = providers.find((x) => x.id === cart.delivery.providerId);
    ideliverProviderId = cart.delivery.providerId;
    ideliverProviderName = p?.fullName.trim() ? p.fullName.trim() : "iDeliver provider";
    ideliverFareSource = cart.delivery.overrideEnabled ? "override" : "computed";
  }

  const totalPaid = roundMoney(Math.max(0, payment.amount));
  const changeDue = roundMoney(Math.max(0, totalPaid - amountDue));

  const hasTax = ts.enabled && ts.ratePercent > 0 && tax.salesTax > 0;

  return {
    id: uid("sale"),
    receiptNumber,
    status,
    createdAt: nowIso(),
    branchId: branch.id,
    lines: cartToSaleLines(cart),
    subtotal: goods,
    deliveryFee,
    amountDue,
    ideliverProviderId,
    ideliverProviderName,
    ideliverFareSource,
    payments: [payment],
    totalPaid,
    changeDue,
    salesTaxAmount: hasTax ? tax.salesTax : undefined,
    taxableNetBase: hasTax ? tax.taxableNetBase : undefined,
    taxableGoodsSubtotal: hasTax ? tax.taxableGoodsGross : undefined,
    taxRatePercentSnapshot: hasTax ? ts.ratePercent : undefined,
    pricesTaxInclusiveSnapshot: hasTax ? ts.pricesTaxInclusive : undefined,
  };
}

export function recordSale(sale: Sale): void {
  const db = getDb();
  db.sales.push(sale);
  setDb(db);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("seigen-pos-sale-recorded"));
  }
}

export function validateTender(cart: Cart, payment: Payment): string | null {
  if (cart.items.length === 0) return "Cart is empty.";
  const providers = loadIdeliverProviders();
  const due = cartAmountDue(cart, providers);
  const paid = roundMoney(Math.max(0, payment.amount));
  if (paid + 1e-9 < due) return `Amount must be at least ${due.toFixed(2)}.`;
  return null;
}

export type FinalizeSaleResult = { ok: true; sale: Sale } | { ok: false; error: string };

/**
 * Phase 2: validate tender + stock, issue receipt number, deduct default-branch stock, persist sale.
 * All-or-nothing in process order: validate → deduct each line → append sale (deduct first minimizes orphan stock if record fails).
 */
export function finalizeSale(cart: Cart, payment: Payment): FinalizeSaleResult {
  const tenderErr = validateTender(cart, payment);
  if (tenderErr) return { ok: false, error: tenderErr };

  const branch = InventoryRepo.getDefaultBranch();
  const stockErr = validateStockForCart(cart, branch.id);
  if (stockErr) return { ok: false, error: stockErr };

  const receiptNumber = nextReceiptNumber();
  const sale = buildSale(cart, payment, receiptNumber, "completed");

  for (const line of sale.lines) {
    InventoryRepo.incrementStock(branch.id, line.productId, -line.qty);
  }

  recordSale(sale);
  recordCogsReservesFromSale(sale);

  if (sale.salesTaxAmount && sale.salesTaxAmount > 0) {
    recordOutputTaxFromSale({
      saleId: sale.id,
      receiptNumber: sale.receiptNumber,
      amount: sale.salesTaxAmount,
      taxableBase: sale.taxableNetBase ?? 0,
      createdAt: sale.createdAt,
    });
  }

  if (sale.deliveryFee > 0 && sale.ideliverProviderId) {
    recordIdeliverDeliveryCredit({
      providerId: sale.ideliverProviderId,
      providerName: sale.ideliverProviderName ?? "Provider",
      saleId: sale.id,
      receiptNumber: sale.receiptNumber,
      deliveryFee: sale.deliveryFee,
    });
  }

  return { ok: true, sale };
}
