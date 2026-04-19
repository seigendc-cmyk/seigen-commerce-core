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

export function ReceiptPreview({ sale, meta = {}, className = "" }: Props) {
  const store = meta.tradingName || meta.storeName || "seiGEN Commerce";
  const branch = meta.branchName ?? sale.branchId;
  const register = meta.registerLabel;

  return (
    <div
      className={`rounded-xl border border-white/10 bg-brand-charcoal/60 p-4 text-sm text-neutral-200 ${className}`}
    >
      {meta.logoDataUrl?.startsWith("data:") ? (
        <div className="mb-3 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={meta.logoDataUrl} alt="" className="max-h-12 max-w-[140px] object-contain" />
        </div>
      ) : null}
      {sale.status === "voided" ? (
        <p className="mb-3 rounded-lg border border-red-500/50 bg-red-950/40 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-red-300">
          Voided receipt
        </p>
      ) : null}
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">{store}</p>
        {meta.legalName?.trim() ? (
          <p className="mt-0.5 text-[10px] text-neutral-500">{meta.legalName}</p>
        ) : null}
        <p className="mt-1 font-mono text-base font-semibold text-brand-orange">{sale.receiptNumber}</p>
        <p className="mt-1 text-xs text-neutral-400">
          {formatReceiptWhen(sale.createdAt)}
          {register ? ` · ${register}` : null}
        </p>
        <p className="mt-0.5 text-xs text-neutral-400">
          Branch: {branch} · {sale.status}
        </p>
      </div>
      <ul className="mt-4 space-y-3 border-t border-white/10 pt-4">
        {sale.lines.map((l, i) => (
          <li key={`${l.productId}-${i}`} className="flex justify-between gap-3 text-xs">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-white">{l.name}</p>
              <p className="text-neutral-500">
                {l.sku} · {l.qty} × {formatReceiptMoney(l.unitPrice)}
              </p>
            </div>
            <p className="shrink-0 font-medium tabular-nums text-neutral-100">{formatReceiptMoney(l.lineTotal)}</p>
          </li>
        ))}
      </ul>
      <div className="mt-4 space-y-1 border-t border-white/10 pt-3 text-xs tabular-nums">
        <div className="flex justify-between text-neutral-400">
          <span>Goods subtotal</span>
          <span className="text-white">{formatReceiptMoney(sale.subtotal)}</span>
        </div>
        {sale.deliveryFee > 0 ? (
          <div className="flex justify-between text-neutral-400">
            <span>
              Delivery (iDeliver)
              {sale.ideliverProviderName ? ` · ${sale.ideliverProviderName}` : null}
            </span>
            <span className="text-white">{formatReceiptMoney(sale.deliveryFee)}</span>
          </div>
        ) : null}
        <div className="flex justify-between border-t border-white/10 pt-2 text-sm font-semibold text-white">
          <span>Amount due</span>
          <span>{formatReceiptMoney(sale.amountDue)}</span>
        </div>
        {sale.payments.map((p, i) => (
          <div key={`${p.method}-${i}`} className="flex justify-between text-neutral-400">
            <span>{paymentLabel(p.method)}</span>
            <span className="text-white">{formatReceiptMoney(p.amount)}</span>
          </div>
        ))}
        <div className="flex justify-between text-neutral-400">
          <span>Total paid</span>
          <span className="text-white">{formatReceiptMoney(sale.totalPaid)}</span>
        </div>
        <div className="flex justify-between border-t border-white/10 pt-2 text-sm font-semibold text-white">
          <span>Change</span>
          <span>{formatReceiptMoney(sale.changeDue)}</span>
        </div>
      </div>
      {meta.footerMessage?.trim() ? (
        <p className="mt-4 border-t border-dashed border-white/15 pt-3 text-center text-[10px] leading-relaxed text-neutral-400">
          {meta.footerMessage}
        </p>
      ) : null}
      {meta.fiscalSignature?.trim() || meta.fiscalQrPayload?.trim() ? (
        <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-2 text-[10px] text-neutral-500">
          {meta.fiscalSignature?.trim() ? (
            <p className="font-mono text-neutral-400">{meta.fiscalSignature}</p>
          ) : null}
          {meta.fiscalQrPayload?.trim() ? (
            <p className="mt-1 break-all font-mono text-neutral-500">OQR: {meta.fiscalQrPayload}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
