"use client";

import { useCallback, useState } from "react";
import { RECEIPT_COLS, formatReceiptPlainText } from "../services/receipt-format";
import { receiptMetaForLocalSale, receiptMetaForLocalSaleWithQr } from "../services/receipt-meta";
import { buildReceiptPdfBlob } from "../services/receipt-pdf";
import { printReceiptReprint } from "../services/receipt-print";
import { saveReceiptPdfWithFilePicker } from "../services/receipt-save";
import type { Sale } from "../types/pos";

function safeFilenamePart(s: string): string {
  return s.replace(/[^a-zA-Z0-9-_]+/g, "_").replace(/^_|_$/g, "") || "receipt";
}

type Props = {
  sale: Sale;
  onClose: () => void;
};

export function PosReceiptReprintModal({ sale, onClose }: Props) {
  const [busy, setBusy] = useState<null | "pdf" | "save" | "print">(null);
  const [hint, setHint] = useState<string | null>(null);

  const memoMeta = receiptMetaForLocalSale(sale);
  const plain = formatReceiptPlainText(sale, memoMeta);

  const runPdfDownload = useCallback(async () => {
    setBusy("pdf");
    setHint(null);
    try {
      const meta = await receiptMetaForLocalSaleWithQr(sale);
      const blob = await buildReceiptPdfBlob(sale, meta, { reprintWatermark: true });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeFilenamePart(`seiGEN-${sale.receiptNumber}`)}-reprint.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setHint("PDF downloaded (check your default Downloads folder).");
    } finally {
      setBusy(null);
    }
  }, [sale]);

  const runSaveToDocuments = useCallback(async () => {
    setBusy("save");
    setHint(null);
    try {
      const meta = await receiptMetaForLocalSaleWithQr(sale);
      const blob = await buildReceiptPdfBlob(sale, meta, { reprintWatermark: true });
      const name = `${safeFilenamePart(`seiGEN-${sale.receiptNumber}`)}-reprint.pdf`;
      const result = await saveReceiptPdfWithFilePicker(blob, name);
      if (result === "saved") {
        setHint("Saved. Tip: choose Documents → receipts (create the folder if needed).");
      } else if (result === "fallback") {
        setHint("Browser saved via download. Move the file to Documents → receipts if you use that folder.");
      }
    } finally {
      setBusy(null);
    }
  }, [sale]);

  const runPrint = useCallback(async () => {
    setBusy("print");
    setHint(null);
    try {
      const meta = await receiptMetaForLocalSaleWithQr(sale);
      printReceiptReprint(sale, meta);
    } finally {
      setBusy(null);
    }
  }, [sale]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reprint-receipt-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex max-h-[min(92vh,880px)] w-full max-w-3xl flex-col rounded-2xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
          <div>
            <h2 id="reprint-receipt-title" className="text-base font-semibold text-slate-900">
              Receipt preview (reprint)
            </h2>
            <p className="pos-data-log-muted mt-0.5 text-xs">
              {sale.receiptNumber} · 80-column layout · marked for reprint only
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden px-4 py-3 sm:px-5">
          <div className="relative max-h-[min(52vh,480px)] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div
              className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden rounded-xl"
              aria-hidden
            >
              <span
                className="origin-center select-none text-[clamp(3rem,12vw,7rem)] font-extrabold tracking-wider text-red-600/[0.11]"
                style={{ transform: "rotate(-28deg)" }}
              >
                Reprint
              </span>
            </div>
            <pre
              className="relative z-[1] m-0 whitespace-pre font-mono text-[11px] leading-snug text-[#36454f]"
              style={{ width: `${RECEIPT_COLS}ch`, maxWidth: "100%" }}
            >
              {plain}
            </pre>
          </div>
          <p className="pos-data-log-muted mt-2 text-[11px] leading-relaxed">
            <strong className="font-semibold text-slate-700">Save to Documents/receipts:</strong> use &quot;Save PDF to
            file…&quot; — the dialog opens in Documents; navigate into a <span className="font-mono">receipts</span>{" "}
            folder (create it if needed), then save. Chrome or Edge recommended.
          </p>
          {hint ? <p className="mt-2 text-xs font-medium text-teal-800">{hint}</p> : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-4 py-3 sm:px-5">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void runPrint()}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:border-teal-500 disabled:opacity-50"
          >
            {busy === "print" ? "…" : "Print"}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void runPdfDownload()}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:border-teal-500 disabled:opacity-50"
          >
            {busy === "pdf" ? "…" : "Download PDF"}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void runSaveToDocuments()}
            className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50"
          >
            {busy === "save" ? "…" : "Save PDF to file…"}
          </button>
        </div>
      </div>
    </div>
  );
}
