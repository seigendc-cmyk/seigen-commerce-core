import { InventoryRepo, branchAllowsTradingOperations } from "@/modules/inventory/services/inventory-repo";
import { browserLocalJson } from "@/modules/inventory/services/storage";
import type { Id } from "@/modules/inventory/types/models";
import type { Cart, Payment, Sale, SaleLine, SaleStatus } from "../types/pos";
import { cartAmountDue, computeCartDeliveryFee } from "./delivery-pricing";
import { loadIdeliverProviders } from "./ideliver-repo";
import { recordIdeliverDeliveryCredit } from "./ideliver-ledger";
import { computeCartSaleTax } from "@/modules/financial/lib/pos-sale-tax";
import { recordCogsReservesFromSale } from "@/modules/financial/services/cogs-reserves-ledger";
import { removeCogsReservesForSale } from "@/modules/financial/services/cogs-reserves-ledger";
import { readTaxOnSalesSettings } from "@/modules/financial/services/tax-settings";
import { recordOutputTaxFromSale } from "@/modules/financial/services/tax-ledger";
import { removeOutputTaxForSale } from "@/modules/financial/services/tax-ledger";
import { recordOutputTaxReturnFromSale } from "@/modules/financial/services/tax-ledger";
import { postAgentDebtorFromConsignmentSale } from "@/modules/consignment/services/consignment-operations";
import { nextReceiptNumber } from "./receipt-number";
import { validateStockForCart } from "./stock-validation";
import { removeIdeliverCreditsForSale } from "./ideliver-ledger";
import { appendDeskAuditEvent } from "@/modules/desk/services/desk-audit";
import { readMoneyContextSnapshot } from "@/modules/financial/services/money-context";
import type { SaleReturn, SaleReturnLine } from "../types/pos";
import { recordCogsReservesFromSaleReturn } from "@/modules/financial/services/cogs-reserves-ledger";

const NS = { namespace: "seigen.pos", version: 1 as const };

type SalesDb = {
  sales: Sale[];
};

type ReturnsDb = {
  returns: SaleReturn[];
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
export function posSalesStorageKey(): string {
  const store = browserLocalJson(NS);
  return store?.fullKey("sales") ?? `${NS.namespace}:v${NS.version}:sales`;
}

export function posReturnsStorageKey(): string {
  const store = browserLocalJson(NS);
  return store?.fullKey("returns") ?? `${NS.namespace}:v${NS.version}:returns`;
}

function getReturnsDb(): ReturnsDb {
  const store = browserLocalJson(NS);
  if (!store) return { returns: [] };
  return store.read<ReturnsDb>("returns", { returns: [] });
}

function setReturnsDb(db: ReturnsDb) {
  const store = browserLocalJson(NS);
  if (!store) return;
  store.write("returns", db);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("seigen-pos-return-recorded"));
  }
}

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
    surface: s.surface === "terminal" ? "terminal" : s.surface === "desktop" ? "desktop" : undefined,
    terminalProfileId: typeof s.terminalProfileId === "string" ? s.terminalProfileId : undefined,
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
    currencyCodeSnapshot:
      typeof s.currencyCodeSnapshot === "string" && s.currencyCodeSnapshot.trim()
        ? s.currencyCodeSnapshot.trim().toUpperCase()
        : undefined,
    taxLabelSnapshot:
      typeof s.taxLabelSnapshot === "string" && s.taxLabelSnapshot.trim() ? s.taxLabelSnapshot.trim() : undefined,
    taxEnabledSnapshot: typeof s.taxEnabledSnapshot === "boolean" ? s.taxEnabledSnapshot : undefined,
    voidedAt: typeof s.voidedAt === "string" ? s.voidedAt : undefined,
    voidedReason: typeof s.voidedReason === "string" ? s.voidedReason : undefined,
  };
}

export function listSales(): Sale[] {
  return getDb()
    .sales.map(normalizeSale)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function normalizeReturn(raw: unknown): SaleReturn {
  const r = raw as Partial<SaleReturn> & Record<string, unknown>;
  const id = (typeof r.id === "string" && r.id ? r.id : `ret_${Date.now()}`) as any;
  const lines = Array.isArray(r.lines) ? (r.lines as SaleReturnLine[]) : [];
  const subtotal = typeof r.subtotal === "number" && Number.isFinite(r.subtotal) ? roundMoney(r.subtotal) : 0;
  return {
    id,
    saleId: (typeof r.saleId === "string" ? r.saleId : "") as any,
    receiptNumber: typeof r.receiptNumber === "string" ? r.receiptNumber : "",
    createdAt: typeof r.createdAt === "string" ? r.createdAt : nowIso(),
    branchId: r.branchId as any,
    surface: r.surface === "terminal" ? "terminal" : r.surface === "desktop" ? "desktop" : undefined,
    terminalProfileId: typeof r.terminalProfileId === "string" ? r.terminalProfileId : undefined,
    reason: typeof r.reason === "string" ? r.reason.slice(0, 280) : "",
    lines,
    subtotal,
    salesTaxAmount:
      typeof r.salesTaxAmount === "number" && Number.isFinite(r.salesTaxAmount)
        ? roundMoney(r.salesTaxAmount)
        : undefined,
    taxableNetBase:
      typeof r.taxableNetBase === "number" && Number.isFinite(r.taxableNetBase)
        ? roundMoney(r.taxableNetBase)
        : undefined,
    currencyCodeSnapshot:
      typeof r.currencyCodeSnapshot === "string" && r.currencyCodeSnapshot.trim()
        ? r.currencyCodeSnapshot.trim().toUpperCase()
        : undefined,
    taxLabelSnapshot:
      typeof r.taxLabelSnapshot === "string" && r.taxLabelSnapshot.trim() ? r.taxLabelSnapshot.trim() : undefined,
    taxEnabledSnapshot: typeof r.taxEnabledSnapshot === "boolean" ? r.taxEnabledSnapshot : undefined,
  };
}

export function listSaleReturns(): SaleReturn[] {
  return getReturnsDb()
    .returns.map(normalizeReturn)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function returnedQtyBySaleId(saleId: Id): Map<Id, number> {
  const m = new Map<Id, number>();
  for (const r of listSaleReturns().filter((x) => x.saleId === saleId)) {
    for (const ln of r.lines) {
      m.set(ln.productId, (m.get(ln.productId) ?? 0) + (Number.isFinite(ln.qty) ? ln.qty : 0));
    }
  }
  return m;
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

export type BuildSaleOptions = {
  /** When omitted, uses default trading branch (desktop POS path). */
  branchId?: Id;
  surface?: "desktop" | "terminal";
  terminalProfileId?: string | null;
};

export function buildSale(
  cart: Cart,
  payments: Payment[] | Payment,
  receiptNumber: string,
  status: SaleStatus = "completed",
  opts?: BuildSaleOptions,
): Sale {
  const branch = opts?.branchId ? InventoryRepo.getBranch(opts.branchId) : InventoryRepo.getDefaultTradingBranch();
  if (!branch) {
    throw new Error("No branch resolved for sale.");
  }
  const providers = loadIdeliverProviders();
  const goods = roundMoney(cart.subtotal);
  const deliveryFee = computeCartDeliveryFee(cart, providers);
  const tax = computeCartSaleTax(cart, providers);
  const amountDue = tax.amountDue;
  const ts = readTaxOnSalesSettings();
  const mc = readMoneyContextSnapshot();

  let ideliverProviderId: string | null = null;
  let ideliverProviderName: string | null = null;
  let ideliverFareSource: Sale["ideliverFareSource"] = "none";

  if (deliveryFee > 0 && cart.delivery.enabled && cart.delivery.providerId) {
    const p = providers.find((x) => x.id === cart.delivery.providerId);
    ideliverProviderId = cart.delivery.providerId;
    ideliverProviderName = p?.fullName.trim() ? p.fullName.trim() : "iDeliver provider";
    ideliverFareSource = cart.delivery.overrideEnabled ? "override" : "computed";
  }

  const paymentRows = Array.isArray(payments) ? payments : [payments];
  const cleanedPayments: Payment[] = paymentRows
    .map((p) => ({
      method: p.method,
      amount: roundMoney(Math.max(0, Number(p.amount))),
    }))
    .filter((p) => Number.isFinite(p.amount) && p.amount > 0);

  const cashPaid = cleanedPayments
    .filter((p) => p.method === "cash")
    .reduce((s, p) => s + p.amount, 0);
  const nonCashPaid = cleanedPayments
    .filter((p) => p.method !== "cash")
    .reduce((s, p) => s + p.amount, 0);

  // Change is only issued from cash, after non-cash reduces the due.
  const remainingAfterNonCash = roundMoney(Math.max(0, amountDue - nonCashPaid));
  const changeDue = roundMoney(Math.max(0, cashPaid - remainingAfterNonCash));
  const totalPaid = roundMoney(cashPaid + nonCashPaid);

  const hasTax = ts.enabled && ts.ratePercent > 0 && tax.salesTax > 0;
  const currency = mc.currencyCode || baseCurrencyCode();

  return {
    id: uid("sale"),
    receiptNumber,
    status,
    createdAt: nowIso(),
    branchId: branch.id,
    surface: opts?.surface,
    terminalProfileId: opts?.terminalProfileId ?? undefined,
    lines: cartToSaleLines(cart),
    subtotal: goods,
    deliveryFee,
    amountDue,
    ideliverProviderId,
    ideliverProviderName,
    ideliverFareSource,
    payments: cleanedPayments,
    totalPaid,
    changeDue,
    salesTaxAmount: hasTax ? tax.salesTax : undefined,
    taxableNetBase: hasTax ? tax.taxableNetBase : undefined,
    taxableGoodsSubtotal: hasTax ? tax.taxableGoodsGross : undefined,
    // Snapshot settings even when tax is off/zero so historical receipts and exports can show the right context.
    taxRatePercentSnapshot: hasTax ? ts.ratePercent : 0,
    pricesTaxInclusiveSnapshot: ts.pricesTaxInclusive,
    currencyCodeSnapshot: currency,
    taxLabelSnapshot: ts.taxLabel,
    taxEnabledSnapshot: ts.enabled === true,
  };
}

export function recordSale(sale: Sale): void {
  const db = getDb();
  // Idempotent per sale id (replace if duplicate).
  db.sales = db.sales.filter((s) => normalizeSale(s).id !== sale.id);
  db.sales.push(sale);
  setDb(db);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("seigen-pos-sale-recorded"));
  }
}

function upsertSaleById(id: Id, patch: Partial<Sale>): Sale | null {
  const db = getDb();
  const idx = db.sales.findIndex((s) => normalizeSale(s).id === id);
  if (idx < 0) return null;
  const prev = normalizeSale(db.sales[idx]!);
  const next: Sale = { ...prev, ...patch, id: prev.id, receiptNumber: prev.receiptNumber, createdAt: prev.createdAt };
  db.sales[idx] = next;
  setDb(db);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("seigen-pos-sale-recorded"));
  }
  return next;
}

function removeSaleById(id: Id): void {
  const db = getDb();
  const next = db.sales.filter((s) => normalizeSale(s).id !== id);
  if (next.length === db.sales.length) return;
  setDb({ sales: next });
}

export type VoidSaleResult = { ok: true; sale: Sale } | { ok: false; error: string };

/**
 * Void (reverse) a completed sale locally: restore stock, mark sale voided, and remove derived ledger effects.
 * This preserves local-first behavior and provides a correction path without introducing refunds/returns yet.
 */
export function voidSale(input: {
  saleId: Id;
  reason: string;
  actorLabel: string;
}): VoidSaleResult {
  const sale = listSales().find((s) => s.id === input.saleId);
  if (!sale) return { ok: false, error: "Sale not found." };
  if (sale.status === "voided") return { ok: false, error: "Sale is already voided." };

  const branch = InventoryRepo.getBranch(sale.branchId);
  if (!branch || !branchAllowsTradingOperations(branch)) {
    return { ok: false, error: "Cannot void: sale branch is not a trading branch." };
  }

  const reason = input.reason.trim();
  if (!reason) return { ok: false, error: "Void reason is required." };

  // Restore stock first (best-effort; mirrors finalizeSale decrement).
  for (const line of sale.lines) {
    InventoryRepo.incrementStock(sale.branchId, line.productId, line.qty);
  }

  // Remove derived ledger effects (best-effort).
  removeCogsReservesForSale(sale.id);
  removeOutputTaxForSale(sale.id);
  removeIdeliverCreditsForSale(sale.id);

  const next = upsertSaleById(sale.id, {
    status: "voided",
    voidedAt: nowIso(),
    voidedReason: reason.slice(0, 280),
  });
  if (!next) return { ok: false, error: "Failed to persist voided sale." };

  appendDeskAuditEvent({
    sourceKind: "pos",
    sourceId: "desktop_pos",
    action: "pos.sale.voided",
    actorLabel: input.actorLabel,
    notes: reason,
    moduleKey: "pos",
    entityType: "sale",
    entityId: sale.id,
    beforeState: { status: sale.status, receiptNumber: sale.receiptNumber },
    afterState: { status: "voided", voidedAt: next.voidedAt, receiptNumber: sale.receiptNumber },
    correlationId: `pos_void_${sale.id}_${Date.now()}`,
  });

  return { ok: true, sale: next };
}

export type ReturnSaleResult = { ok: true; ret: SaleReturn } | { ok: false; error: string };

export function returnSale(input: {
  saleId: Id;
  reason: string;
  lines: Array<{ productId: Id; qty: number }>;
  surface?: "desktop" | "terminal";
  terminalProfileId?: string | null;
}): ReturnSaleResult {
  const sale = listSales().find((s) => s.id === input.saleId);
  if (!sale) return { ok: false, error: "Sale not found." };
  if (sale.status !== "completed") return { ok: false, error: "Only completed sales can be returned." };

  const reason = input.reason.trim();
  if (!reason) return { ok: false, error: "Return reason is required." };
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    return { ok: false, error: "Select at least one item to return." };
  }

  const branch = InventoryRepo.getBranch(sale.branchId);
  if (!branch || !branchAllowsTradingOperations(branch)) {
    return { ok: false, error: "Cannot return: sale branch is not a trading branch." };
  }

  const already = returnedQtyBySaleId(sale.id);
  const soldByProduct = new Map<Id, SaleLine>();
  for (const ln of sale.lines) soldByProduct.set(ln.productId, ln);

  const retLines: SaleReturnLine[] = [];
  for (const pick of input.lines) {
    const qty = Math.floor(Number(pick.qty));
    if (!Number.isFinite(qty) || qty <= 0) continue;
    const sold = soldByProduct.get(pick.productId);
    if (!sold) return { ok: false, error: "Return contains an item not in the original sale." };
    const prev = already.get(pick.productId) ?? 0;
    const remaining = sold.qty - prev;
    if (qty > remaining) {
      return { ok: false, error: `Return qty exceeds remaining sold qty for ${sold.name}. Remaining ${remaining}.` };
    }
    const unitPrice = roundMoney(sold.unitPrice);
    const lineTotal = roundMoney(unitPrice * qty);
    retLines.push({
      productId: sold.productId,
      sku: sold.sku,
      name: sold.name,
      unit: sold.unit,
      unitPrice,
      qty,
      lineTotal,
      taxable: sold.taxable,
    });
  }

  if (retLines.length === 0) return { ok: false, error: "No valid return quantities selected." };

  const subtotal = roundMoney(retLines.reduce((s, l) => s + l.lineTotal, 0));

  // Tax reversal: compute from returned taxable lines using sale snapshots where possible.
  const mc = readMoneyContextSnapshot();
  const taxEnabled = sale.taxEnabledSnapshot ?? mc.taxEnabled;
  const taxRate = typeof sale.taxRatePercentSnapshot === "number" ? sale.taxRatePercentSnapshot : mc.taxRatePercent;
  const pricesTaxInclusive =
    typeof sale.pricesTaxInclusiveSnapshot === "boolean" ? sale.pricesTaxInclusiveSnapshot : mc.pricesTaxInclusive;

  let taxableGoodsGross = 0;
  for (const l of retLines) if (l.taxable !== false) taxableGoodsGross += l.lineTotal;
  taxableGoodsGross = roundMoney(taxableGoodsGross);

  const toNetBase = (gross: number) => {
    if (!taxEnabled || !taxRate || taxRate <= 0) return 0;
    if (!pricesTaxInclusive) return roundMoney(gross);
    const factor = 1 + taxRate / 100;
    return roundMoney(gross / factor);
  };

  const taxableNetBase = taxEnabled && taxRate > 0 ? toNetBase(taxableGoodsGross) : 0;
  const salesTaxAmount = taxEnabled && taxRate > 0 ? roundMoney(taxableGoodsGross - taxableNetBase) : 0;

  const ret: SaleReturn = {
    id: uid("ret"),
    saleId: sale.id,
    receiptNumber: sale.receiptNumber,
    createdAt: nowIso(),
    branchId: sale.branchId,
    surface: input.surface,
    terminalProfileId: input.terminalProfileId ?? undefined,
    reason: reason.slice(0, 280),
    lines: retLines,
    subtotal,
    salesTaxAmount: salesTaxAmount > 0 ? salesTaxAmount : undefined,
    taxableNetBase: taxableNetBase > 0 ? taxableNetBase : undefined,
    currencyCodeSnapshot: sale.currencyCodeSnapshot,
    taxLabelSnapshot: sale.taxLabelSnapshot,
    taxEnabledSnapshot: sale.taxEnabledSnapshot,
  };

  const applied: Array<{ productId: Id; qty: number }> = [];
  try {
    for (const l of ret.lines) {
      InventoryRepo.incrementStock(ret.branchId, l.productId, l.qty);
      applied.push({ productId: l.productId, qty: l.qty });
    }

    const db = getReturnsDb();
    db.returns = db.returns.filter((x) => normalizeReturn(x).id !== ret.id);
    db.returns.push(ret);
    setReturnsDb(db);

    recordCogsReservesFromSaleReturn({
      returnId: ret.id,
      saleId: sale.id,
      receiptNumber: sale.receiptNumber,
      branchId: sale.branchId,
      createdAt: ret.createdAt,
      lines: ret.lines.map((l) => ({ productId: l.productId, sku: l.sku, name: l.name, qty: l.qty })),
    });

    if (ret.salesTaxAmount && ret.taxableNetBase) {
      recordOutputTaxReturnFromSale({
        returnId: ret.id,
        saleId: sale.id,
        receiptNumber: sale.receiptNumber,
        amount: ret.salesTaxAmount,
        taxableBase: ret.taxableNetBase,
        createdAt: ret.createdAt,
      });
    }

    appendDeskAuditEvent({
      sourceKind: "pos",
      sourceId: input.surface === "terminal" ? "terminal_pos" : "desktop_pos",
      action: "pos.sale.returned",
      actorLabel: "POS",
      notes: ret.reason,
      moduleKey: "pos",
      entityType: "sale",
      entityId: sale.id,
      correlationId: `pos_return_${ret.id}_${Date.now()}`,
      afterState: { returnId: ret.id, receiptNumber: sale.receiptNumber, subtotal: ret.subtotal },
    });

    return { ok: true, ret };
  } catch (e) {
    for (const a of applied) {
      InventoryRepo.incrementStock(ret.branchId, a.productId, -a.qty);
    }
    const db = getReturnsDb();
    const next = db.returns.filter((x) => normalizeReturn(x).id !== ret.id);
    if (next.length !== db.returns.length) setReturnsDb({ returns: next });
    return { ok: false, error: e instanceof Error ? e.message : "Failed to return sale." };
  }
}

export function validateTender(cart: Cart, payments: Payment[] | Payment): string | null {
  if (cart.items.length === 0) return "Cart is empty.";
  const providers = loadIdeliverProviders();
  const due = cartAmountDue(cart, providers);

  const rows = (Array.isArray(payments) ? payments : [payments])
    .map((p) => ({ method: p.method, amount: roundMoney(Math.max(0, Number(p.amount))) }))
    .filter((p) => Number.isFinite(p.amount) && p.amount > 0);

  if (rows.length === 0) return "Enter at least one payment amount.";

  const cashPaid = rows.filter((p) => p.method === "cash").reduce((s, p) => s + p.amount, 0);
  const nonCashPaid = rows.filter((p) => p.method !== "cash").reduce((s, p) => s + p.amount, 0);
  const totalPaid = roundMoney(cashPaid + nonCashPaid);

  // Non-cash cannot be over-tendered (no change for card/mobile/bank in MVP).
  if (nonCashPaid - due > 1e-9) return "Non-cash payment cannot exceed amount due.";
  if (totalPaid + 1e-9 < due) return `Total payments must be at least ${due.toFixed(2)}.`;

  return null;
}

export type FinalizeSaleResult = { ok: true; sale: Sale } | { ok: false; error: string };

export type FinalizeSaleOptions = {
  /** When set (mobile terminal), stock and sale.branchId use this branch/stall. Desktop POS omits this. */
  branchId?: Id;
  surface?: "desktop" | "terminal";
  terminalProfileId?: string | null;
};

/**
 * Phase 2: validate tender + stock, issue receipt number, deduct default-branch stock, persist sale.
 * All-or-nothing in process order: validate → deduct each line → append sale (deduct first minimizes orphan stock if record fails).
 */
export function finalizeSale(cart: Cart, payments: Payment[] | Payment, opts?: FinalizeSaleOptions): FinalizeSaleResult {
  const tenderErr = validateTender(cart, payments);
  if (tenderErr) return { ok: false, error: tenderErr };

  const branch = opts?.branchId ? InventoryRepo.getBranch(opts.branchId) : InventoryRepo.getDefaultTradingBranch();
  if (!branch) {
    return {
      ok: false,
      error:
        "No trading shop is configured — Head office cannot ring sales. Add a trading branch under Inventory → Overview.",
    };
  }
  if (!branchAllowsTradingOperations(branch)) {
    return { ok: false, error: "This location cannot ring POS sales. Use a trading shop or consignment stall branch." };
  }
  const stockErr = validateStockForCart(cart, branch.id);
  if (stockErr) return { ok: false, error: stockErr };

  const receiptNumber = nextReceiptNumber({ terminalProfileId: opts?.terminalProfileId ?? null });
  const sale = buildSale(cart, payments, receiptNumber, "completed", {
    branchId: branch.id,
    surface: opts?.surface,
    terminalProfileId: opts?.terminalProfileId ?? undefined,
  });

  const applied: Array<{ productId: Id; qty: number }> = [];
  try {
    for (const line of sale.lines) {
      // Multi-terminal safety baseline: re-check stock right before decrement to detect contention drift.
      const onHandNow = InventoryRepo.getStock(branch.id, line.productId)?.onHandQty ?? 0;
      if (line.qty > onHandNow) {
        throw new Error(
          `Stock changed while checking out for ${line.name} (${line.sku}): need ${line.qty}, have ${onHandNow}. ` +
            `Another terminal may have sold this item. Refresh catalog and try again.`,
        );
      }
      InventoryRepo.incrementStock(branch.id, line.productId, -line.qty);
      applied.push({ productId: line.productId, qty: line.qty });
    }

    recordSale(sale);
    recordCogsReservesFromSale(sale);
    postAgentDebtorFromConsignmentSale({
      saleId: sale.id,
      receiptNumber: sale.receiptNumber,
      createdAt: sale.createdAt,
      stallBranchId: sale.branchId,
      lines: sale.lines.map((l) => ({ productId: l.productId, qty: l.qty })),
    });

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
  } catch (e) {
    // Best-effort local atomicity: if downstream persistence/postings throw, revert applied stock and remove appended sale.
    for (const a of applied) {
      InventoryRepo.incrementStock(branch.id, a.productId, a.qty);
    }
    removeSaleById(sale.id);
    return { ok: false, error: e instanceof Error ? e.message : "Failed to finalize sale." };
  }
}
