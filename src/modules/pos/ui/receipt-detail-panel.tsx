"use client";

import type { Sale } from "../types/pos";
import type { ReceiptFormatMeta } from "../services/receipt-format";
import { ReceiptOutputActions } from "./receipt-output-actions";
import { ReceiptPreview } from "./receipt-preview";

type Props = {
  sale: Sale;
  meta?: ReceiptFormatMeta;
  title?: string;
  onDismiss?: () => void;
  dismissLabel?: string;
};

export function ReceiptDetailPanel({
  sale,
  meta,
  title = "Receipt",
  onDismiss,
  dismissLabel = "Dismiss",
}: Props) {
  return (
    <div className="vendor-panel rounded-2xl border border-teal-500/35 p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 text-xs font-semibold text-teal-600 hover:underline"
          >
            {dismissLabel}
          </button>
        ) : null}
      </div>
      <ReceiptPreview sale={sale} meta={meta} />
      <ReceiptOutputActions sale={sale} meta={meta} className="mt-4" />
    </div>
  );
}
