import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";
import { DEFAULT_REGISTER_LABEL } from "../mock";
import type { Sale } from "../types/pos";
import type { ReceiptFormatMeta } from "./receipt-format";
import { loadReceiptBranding } from "./receipt-branding";
import { buildFiscalQrDataUrl } from "./receipt-qr";

/** Branch name + register label + receipt branding for POS output. */
export function receiptMetaForLocalSale(sale: Sale): ReceiptFormatMeta {
  const branch = InventoryRepo.getBranch(sale.branchId);
  const b = loadReceiptBranding();
  const store = b.tradingName.trim() || b.legalName.trim() || "seiGEN Commerce";
  return {
    storeName: store,
    tradingName: b.tradingName || undefined,
    legalName: b.legalName || undefined,
    taxId: b.taxId || undefined,
    addressLines: b.addressLines || undefined,
    phone: b.phone || undefined,
    branchName: branch?.name ?? sale.branchId,
    registerLabel: DEFAULT_REGISTER_LABEL,
    logoDataUrl: b.logoDataUrl,
    footerMessage: b.footerMessage,
    fiscalSignature: b.fiscalSignature,
    fiscalQrPayload: b.fiscalQrPayload,
  };
}

/** Same as receiptMetaForLocalSale but embeds OQR image when payload is set. */
export async function receiptMetaForLocalSaleWithQr(sale: Sale): Promise<ReceiptFormatMeta> {
  const base = receiptMetaForLocalSale(sale);
  const fiscalQrDataUrl = await buildFiscalQrDataUrl(base.fiscalQrPayload ?? "");
  return { ...base, fiscalQrDataUrl };
}
