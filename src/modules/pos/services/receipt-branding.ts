import { browserLocalJson } from "@/modules/inventory/services/storage";

const NS = { namespace: "seigen.pos", version: 1 as const };

/** Vendor-facing receipt & fiscal presentation (local draft until workspace API). */
export type ReceiptBranding = {
  tradingName: string;
  legalName: string;
  taxId: string;
  addressLines: string;
  phone: string;
  /** Optional logo — data URL (small PNG/WebP). */
  logoDataUrl: string | null;
  footerMessage: string;
  /** Fiscal / tax authority digital signature string when registered. */
  fiscalSignature: string;
  /** Payload encoded into OQR (verification URL or signed blob). */
  fiscalQrPayload: string;
};

export const defaultReceiptBranding = (): ReceiptBranding => ({
  tradingName: "seiGEN Commerce",
  legalName: "",
  taxId: "",
  addressLines: "",
  phone: "",
  logoDataUrl: null,
  footerMessage: "Thank you for your purchase. Goods once sold are not returnable except as required by law.",
  fiscalSignature: "",
  fiscalQrPayload: "",
});

export function loadReceiptBranding(): ReceiptBranding {
  const store = browserLocalJson(NS);
  if (!store) return defaultReceiptBranding();
  const raw = store.read<Partial<ReceiptBranding>>("receipt_branding", {});
  const d = defaultReceiptBranding();
  return {
    ...d,
    ...raw,
    logoDataUrl: typeof raw.logoDataUrl === "string" || raw.logoDataUrl === null ? raw.logoDataUrl : d.logoDataUrl,
  };
}

export function saveReceiptBranding(b: ReceiptBranding): void {
  const store = browserLocalJson(NS);
  if (!store) return;
  store.write("receipt_branding", b);
}
