"use client";

import { useState } from "react";
import type { Sale } from "../types/pos";
import { downloadReceiptJsonFile, downloadReceiptTextFile } from "../services/receipt-download";
import { downloadReceiptPdf } from "../services/receipt-pdf";
import type { ReceiptFormatMeta } from "../services/receipt-format";
import { formatReceiptPlainText } from "../services/receipt-format";
import { printReceiptInNewWindow } from "../services/receipt-print";
import { receiptMetaForLocalSaleWithQr } from "../services/receipt-meta";
import { buildTelegramShareUrl, buildWhatsAppShareUrl } from "../services/receipt-share";

type Props = {
  sale: Sale;
  meta?: ReceiptFormatMeta;
  className?: string;
};

export function ReceiptOutputActions({ sale, meta, className = "" }: Props) {
  const [busy, setBusy] = useState<null | "print" | "pdf">(null);
  const shareText = formatReceiptPlainText(sale, meta);

  async function metaWithQr(): Promise<ReceiptFormatMeta> {
    const base = await receiptMetaForLocalSaleWithQr(sale);
    return { ...base, ...meta };
  }

  async function handlePrint() {
    setBusy("print");
    try {
      const m = await metaWithQr();
      printReceiptInNewWindow(sale, m);
    } finally {
      setBusy(null);
    }
  }

  async function handlePdf() {
    setBusy("pdf");
    try {
      const m = await metaWithQr();
      await downloadReceiptPdf(sale, m);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void handlePrint()}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-xs font-semibold text-slate-800 shadow-sm hover:border-teal-500 hover:bg-slate-50 disabled:opacity-50"
        >
          {busy === "print" ? "…" : "Print"}
        </button>
        <button
          type="button"
          onClick={() => downloadReceiptTextFile(sale, meta)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-xs font-semibold text-slate-800 shadow-sm hover:border-teal-500 hover:bg-slate-50"
        >
          .txt
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void handlePdf()}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-xs font-semibold text-slate-800 shadow-sm hover:border-teal-500 hover:bg-slate-50 disabled:opacity-50"
        >
          {busy === "pdf" ? "…" : "PDF"}
        </button>
        <button
          type="button"
          onClick={() => downloadReceiptJsonFile(sale)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-xs font-semibold text-slate-800 shadow-sm hover:border-teal-500 hover:bg-slate-50"
        >
          JSON
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <a
          href={buildWhatsAppShareUrl(shareText)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-center text-xs font-semibold text-emerald-900 hover:border-emerald-400"
        >
          WhatsApp
        </a>
        <a
          href={buildTelegramShareUrl(shareText)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-center text-xs font-semibold text-sky-900 hover:border-sky-400"
        >
          Telegram
        </a>
      </div>
      <p className="pos-data-log-muted text-[10px] leading-snug">
        Print/PDF embed 80-column layout, vendor block, footer, and fiscal OQR when configured under Receipt appearance.
        Share links use plain text; use PDF for full layout in chat.
      </p>
    </div>
  );
}
