import type { IdeliverExternalProvider } from "@/modules/dashboard/settings/ideliver/ideliver-types";
import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";
import type { PurchaseOrder } from "@/modules/inventory/types/models";
import type { Cart } from "@/modules/pos/types/pos";
import { computeCartDeliveryFee } from "@/modules/pos/services/delivery-pricing";
import { effectiveTaxRatePercent, readTaxOnSalesSettings } from "@/modules/financial/services/tax-settings";

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export type CartTaxBreakdown = {
  /** Total output tax for this cart (goods + delivery components). */
  salesTax: number;
  /** Net amount that was taxed (for reference). */
  taxableNetBase: number;
  /** Gross taxable goods (POS line totals summed for taxable lines). */
  taxableGoodsGross: number;
  exemptGoodsSubtotal: number;
  amountDue: number;
};

/**
 * POS totals including VAT/GST when enabled in Settings → Tax.
 */
export function computeCartSaleTax(cart: Cart, providers: IdeliverExternalProvider[]): CartTaxBreakdown {
  const settings = readTaxOnSalesSettings();
  const r = effectiveTaxRatePercent();
  const rateFrac = r / 100;
  const deliveryFee = computeCartDeliveryFee(cart, providers);

  const goods = roundMoney(cart.subtotal);

  if (!settings.enabled || r <= 0) {
    return {
      salesTax: 0,
      taxableNetBase: 0,
      taxableGoodsGross: 0,
      exemptGoodsSubtotal: goods,
      amountDue: roundMoney(goods + deliveryFee),
    };
  }

  let taxableGoods = 0;
  let exemptGoods = 0;
  for (const it of cart.items) {
    const t = it.taxable !== false;
    if (t) taxableGoods += it.lineTotal;
    else exemptGoods += it.lineTotal;
  }
  taxableGoods = roundMoney(taxableGoods);
  exemptGoods = roundMoney(exemptGoods);

  if (settings.pricesTaxInclusive) {
    let taxGoods = 0;
    let netGoods = 0;
    if (taxableGoods > 0 && rateFrac > 0) {
      netGoods = roundMoney(taxableGoods / (1 + rateFrac));
      taxGoods = roundMoney(taxableGoods - netGoods);
    }
    let taxDel = 0;
    let netDel = 0;
    if (settings.applyTaxToDelivery && deliveryFee > 0 && rateFrac > 0) {
      netDel = roundMoney(deliveryFee / (1 + rateFrac));
      taxDel = roundMoney(deliveryFee - netDel);
    }
    const salesTax = roundMoney(taxGoods + taxDel);
    const taxableNetBase = roundMoney(netGoods + netDel);
    const amountDue = roundMoney(cart.subtotal + deliveryFee);
    return {
      salesTax,
      taxableNetBase,
      taxableGoodsGross: taxableGoods,
      exemptGoodsSubtotal: exemptGoods,
      amountDue,
    };
  }

  const taxGoods = roundMoney(taxableGoods * rateFrac);
  let taxDel = 0;
  if (settings.applyTaxToDelivery && deliveryFee > 0) {
    taxDel = roundMoney(deliveryFee * rateFrac);
  }
  const salesTax = roundMoney(taxGoods + taxDel);
  const taxableNetBase = roundMoney(taxableGoods + (settings.applyTaxToDelivery ? deliveryFee : 0));
  const amountDue = roundMoney(cart.subtotal + deliveryFee + salesTax);
  return {
    salesTax,
    taxableNetBase,
    taxableGoodsGross: taxableGoods,
    exemptGoodsSubtotal: exemptGoods,
    amountDue,
  };
}

export function computePurchaseOrderInputTax(po: PurchaseOrder): { inputTax: number; taxableBase: number } {
  const settings = readTaxOnSalesSettings();
  const r = effectiveTaxRatePercent();
  if (!settings.enabled || r <= 0) return { inputTax: 0, taxableBase: 0 };
  const rateFrac = r / 100;

  let taxable = 0;
  for (const it of po.items) {
    const p = InventoryRepo.getProduct(it.productId);
    const line = roundMoney(it.orderedQty * it.expectedUnitCost);
    if (p?.taxable !== false) taxable += line;
  }
  taxable = roundMoney(taxable);
  if (taxable <= 0) return { inputTax: 0, taxableBase: 0 };

  if (settings.purchaseCostsTaxInclusive) {
    const net = roundMoney(taxable / (1 + rateFrac));
    return { inputTax: roundMoney(taxable - net), taxableBase: net };
  }
  return { inputTax: roundMoney(taxable * rateFrac), taxableBase: taxable };
}
