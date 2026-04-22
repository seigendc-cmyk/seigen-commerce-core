"use client";

import { useState } from "react";
import {
  defaultReceiptBranding,
  loadReceiptBranding,
  saveReceiptBranding,
  type ReceiptBranding,
} from "../services/receipt-branding";

export function PosReceiptBrandingPanel() {
  const [open, setOpen] = useState(false);
  const [b, setB] = useState<ReceiptBranding>(() => loadReceiptBranding());
  const [hint, setHint] = useState<string | null>(null);

  function persist(next: ReceiptBranding) {
    setB(next);
    saveReceiptBranding(next);
    setHint("Saved for this browser.");
    window.setTimeout(() => setHint(null), 2500);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-xs font-semibold text-slate-900"
      >
        <span>Receipt appearance &amp; fiscal (OQR)</span>
        <span className="pos-data-log-muted">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <div className="space-y-3 border-t border-slate-200 px-3 py-3">
          <p className="pos-data-log-muted text-[10px] leading-relaxed">
            Used for 80-column PDF, print, and previews. Logo as small PNG/WebP data URL (paste or use a file picker in a
            future build).
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="pos-data-log block text-[10px] font-semibold">
              Trading name
              <input
                value={b.tradingName}
                onChange={(e) => persist({ ...b, tradingName: e.target.value })}
                className="vendor-field mt-1 w-full rounded px-2 py-1.5 text-xs"
              />
            </label>
            <label className="pos-data-log block text-[10px] font-semibold">
              Legal name
              <input
                value={b.legalName}
                onChange={(e) => persist({ ...b, legalName: e.target.value })}
                className="vendor-field mt-1 w-full rounded px-2 py-1.5 text-xs"
              />
            </label>
          </div>
          <label className="pos-data-log block text-[10px] font-semibold">
            Tax / VAT ID
            <input
              value={b.taxId}
              onChange={(e) => persist({ ...b, taxId: e.target.value })}
              className="vendor-field mt-1 w-full rounded px-2 py-1.5 text-xs"
            />
          </label>
          <label className="pos-data-log block text-[10px] font-semibold">
            Address (multi-line)
            <textarea
              value={b.addressLines}
              onChange={(e) => persist({ ...b, addressLines: e.target.value })}
              rows={2}
              className="vendor-field mt-1 w-full resize-y rounded px-2 py-1.5 text-xs"
            />
          </label>
          <label className="pos-data-log block text-[10px] font-semibold">
            Phone
            <input
              value={b.phone}
              onChange={(e) => persist({ ...b, phone: e.target.value })}
              className="vendor-field mt-1 w-full rounded px-2 py-1.5 text-xs"
            />
          </label>
          <label className="pos-data-log block text-[10px] font-semibold">
            Logo (data URL, optional)
            <input
              value={b.logoDataUrl ?? ""}
              onChange={(e) => persist({ ...b, logoDataUrl: e.target.value.trim() ? e.target.value : null })}
              className="vendor-field mt-1 w-full rounded px-2 py-1.5 font-mono text-[10px]"
              placeholder="data:image/png;base64,..."
            />
          </label>
          <label className="pos-data-log block text-[10px] font-semibold">
            Footer message
            <textarea
              value={b.footerMessage}
              onChange={(e) => persist({ ...b, footerMessage: e.target.value })}
              rows={2}
              className="vendor-field mt-1 w-full resize-y rounded px-2 py-1.5 text-xs"
            />
          </label>
          <label className="pos-data-log block text-[10px] font-semibold">
            Fiscal / verification signature
            <textarea
              value={b.fiscalSignature}
              onChange={(e) => persist({ ...b, fiscalSignature: e.target.value })}
              rows={2}
              className="vendor-field mt-1 w-full resize-y rounded px-2 py-1.5 font-mono text-[10px]"
              placeholder="Authority signature block when registered"
            />
          </label>
          <label className="pos-data-log block text-[10px] font-semibold">
            OQR payload (encoded in QR below footer)
            <textarea
              value={b.fiscalQrPayload}
              onChange={(e) => persist({ ...b, fiscalQrPayload: e.target.value })}
              rows={2}
              className="vendor-field mt-1 w-full resize-y rounded px-2 py-1.5 font-mono text-[10px]"
              placeholder="URL or signed fiscal blob for customer verification"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => persist(defaultReceiptBranding())}
              className="text-[10px] font-semibold text-slate-600 hover:text-slate-900"
            >
              Reset defaults
            </button>
            {hint ? <span className="text-[10px] font-semibold text-emerald-700">{hint}</span> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
