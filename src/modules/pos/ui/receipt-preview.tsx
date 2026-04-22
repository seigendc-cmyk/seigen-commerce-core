import { readTaxOnSalesSettings } from "@/modules/financial/services/tax-settings";
import type { Sale } from "../types/pos";
import {
  formatReceiptMoney,
  formatReceiptWhen,
  paymentLabel,
  type ReceiptFormatMeta,
} from "../services/receipt-format";

type Props = {
  sale: Sale;
  meta?: ReceiptFormatMeta;
  className?: string;
};

const LOG = "text-[#36454f]";

export function ReceiptPreview({ sale, meta = {}, className = "" }: Props) {
  const store = meta.tradingName || meta.storeName || "seiGEN Commerce";
  const branch = meta.branchName ?? sale.branchId;
  const register = meta.registerLabel;

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-900 shadow-inner ${className}`}
    >
      {meta.logoDataUrl?.startsWith("data:") ? (
        <div className="mb-3 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={meta.logoDataUrl} alt="" className="max-h-12 max-w-[140px] object-contain" />
        </div>
      ) : null}
      {sale.status === "voided" ? (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-red-800">
          Voided receipt
        </p>
      ) : null}
      <div className="text-center">
        <p className={`text-xs font-semibold uppercase tracking-wider ${LOG}`}>{store}</p>
        {meta.legalName?.trim() ? (
          <p className={`mt-0.5 text-[10px] font-medium ${LOG}`}>{meta.legalName}</p>
        ) : null}
        <p className="mt-1 font-mono text-base font-semibold text-teal-700">{sale.receiptNumber}</p>
        <p className={`mt-1 text-xs font-medium ${LOG}`}>
          {formatReceiptWhen(sale.createdAt)}
          {register ? ` · ${register}` : null}
        </p>
        <p className={`mt-0.5 text-xs font-medium ${LOG}`}>
          Branch: {branch} · {sale.status}
        </p>
      </div>
      <ul className="mt-4 space-y-3 border-t border-slate-200 pt-4">
        {sale.lines.map((l, i) => (
          <li key={`${l.productId}-${i}`} className="flex justify-between gap-3 text-xs">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">{l.name}</p>
              <p className={`font-medium ${LOG}`}>
                {l.sku} · {l.qty} × {formatReceiptMoney(l.unitPrice)}
              </p>
            </div>
            <p className={`shrink-0 font-semibold tabular-nums ${LOG}`}>{formatReceiptMoney(l.lineTotal)}</p>
          </li>
        ))}
      </ul>
      <div className="mt-4 space-y-1 border-t border-slate-200 pt-3 text-xs tabular-nums">
        <div className={`flex justify-between font-medium ${LOG}`}>
          <span>Goods subtotal</span>
          <span className="text-slate-900">{formatReceiptMoney(sale.subtotal)}</span>
        </div>
        {sale.deliveryFee > 0 ? (
          <div className={`flex justify-between font-medium ${LOG}`}>
            <span>
              Delivery (iDeliver)
              {sale.ideliverProviderName ? ` · ${sale.ideliverProviderName}` : null}
            </span>
            <span className="text-slate-900">{formatReceiptMoney(sale.deliveryFee)}</span>
          </div>
        ) : null}
        {sale.salesTaxAmount && sale.salesTaxAmount > 0 ? (
          <div className={`flex justify-between font-medium ${LOG}`}>
            <span>
              {readTaxOnSalesSettings().taxLabel}
              {sale.taxRatePercentSnapshot != null ? ` (${sale.taxRatePercentSnapshot}%)` : null}
              {sale.pricesTaxInclusiveSnapshot ? " · incl. in prices" : null}
            </span>
            <span className="text-slate-900">{formatReceiptMoney(sale.salesTaxAmount)}</span>
          </div>
        ) : null}
        <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-semibold text-slate-900">
          <span>Amount due</span>
          <span>{formatReceiptMoney(sale.amountDue)}</span>
        </div>
        {sale.payments.map((p, i) => (
          <div key={`${p.method}-${i}`} className={`flex justify-between font-medium ${LOG}`}>
            <span>{paymentLabel(p.method)}</span>
            <span className="text-slate-900">{formatReceiptMoney(p.amount)}</span>
          </div>
        ))}
        <div className={`flex justify-between font-medium ${LOG}`}>
          <span>Total paid</span>
          <span className="text-slate-900">{formatReceiptMoney(sale.totalPaid)}</span>
        </div>
        <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-semibold text-slate-900">
          <span>Change</span>
          <span>{formatReceiptMoney(sale.changeDue)}</span>
        </div>
      </div>
      {meta.footerMessage?.trim() ? (
        <p className={`mt-4 border-t border-dashed border-slate-200 pt-3 text-center text-[10px] font-medium leading-relaxed ${LOG}`}>
          {meta.footerMessage}
        </p>
      ) : null}
      {meta.fiscalSignature?.trim() || meta.fiscalQrPayload?.trim() ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2 text-[10px]">
          {meta.fiscalSignature?.trim() ? (
            <p className={`font-mono font-medium ${LOG}`}>{meta.fiscalSignature}</p>
          ) : null}
          {meta.fiscalQrPayload?.trim() ? (
            <p className={`mt-1 break-all font-mono font-medium ${LOG}`}>OQR: {meta.fiscalQrPayload}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
