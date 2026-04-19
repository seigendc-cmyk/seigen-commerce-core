"use client";

import { useRef } from "react";

export type ComplianceDocSlot = {
  file: File | null;
  /** When true, storefront may show a link or badge (storage + RLS not wired yet). */
  showOnStorefront: boolean;
};

type DocKey = "taxClearance" | "companyRegistration" | "tradingLicense";

const LABELS: Record<
  DocKey,
  { title: string; description: string; inputId: string }
> = {
  taxClearance: {
    title: "Tax clearance",
    description: "Current clearance certificate or equivalent from your revenue authority.",
    inputId: "bp-doc-tax-clearance",
  },
  companyRegistration: {
    title: "Certificate of company registration",
    description: "Certificate of incorporation or equivalent registry extract.",
    inputId: "bp-doc-co-reg-cert",
  },
  tradingLicense: {
    title: "Trading licence",
    description: "Municipal or sector trading licence where required.",
    inputId: "bp-doc-trading-lic",
  },
};

type Props = {
  docs: Record<DocKey, ComplianceDocSlot>;
  onChange: (key: DocKey, next: ComplianceDocSlot) => void;
};

export function ComplianceDocuments({ docs, onChange }: Props) {
  const refs = useRef<Record<DocKey, HTMLInputElement | null>>({
    taxClearance: null,
    companyRegistration: null,
    tradingLicense: null,
  });

  function pickFile(key: DocKey, list: FileList | null) {
    const file = list?.[0] ?? null;
    onChange(key, { ...docs[key], file });
  }

  function clearFile(key: DocKey) {
    onChange(key, { ...docs[key], file: null });
    const input = refs.current[key];
    if (input) input.value = "";
  }

  return (
    <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
      <div>
        <h4 className="text-sm font-semibold text-white">Compliance documents</h4>
        <p className="mt-1 text-xs text-neutral-400">
          Upload PDF or images. Storage and virus scan connect when Supabase Storage is enabled. You can choose which
          files shoppers may see on your public storefront.
        </p>
      </div>
      {(Object.keys(LABELS) as DocKey[]).map((key) => {
        const meta = LABELS[key];
        const slot = docs[key];
        return (
          <div
            key={key}
            className="rounded-lg border border-white/10 bg-neutral-900/40 px-3 py-3 sm:flex sm:flex-wrap sm:items-start sm:gap-4"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-neutral-200">{meta.title}</p>
              <p className="mt-0.5 text-xs text-neutral-500">{meta.description}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  ref={(el) => {
                    refs.current[key] = el;
                  }}
                  id={meta.inputId}
                  type="file"
                  accept=".pdf,image/jpeg,image/png,image/webp,application/pdf"
                  className="max-w-full text-xs text-neutral-300 file:mr-2 file:rounded file:border-0 file:bg-neutral-700 file:px-2 file:py-1 file:text-neutral-200"
                  onChange={(e) => pickFile(key, e.target.files)}
                />
                {slot.file ? (
                  <button
                    type="button"
                    onClick={() => clearFile(key)}
                    className="text-xs font-medium text-red-400 hover:text-red-300"
                  >
                    Remove file
                  </button>
                ) : null}
              </div>
              {slot.file ? (
                <p className="mt-1 text-xs text-neutral-400">
                  Selected: <span className="font-mono text-neutral-300">{slot.file.name}</span>
                </p>
              ) : null}
            </div>
            <label className="flex shrink-0 cursor-pointer items-start gap-2 pt-1 sm:pt-6">
              <input
                type="checkbox"
                checked={slot.showOnStorefront}
                onChange={(e) => onChange(key, { ...slot, showOnStorefront: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-neutral-600 bg-neutral-800 text-brand-orange focus:ring-brand-orange"
              />
              <span className="text-xs leading-snug text-neutral-300">
                Show on public online storefront
                <span className="mt-0.5 block text-[11px] text-neutral-500">
                  Customers can view or download when your storefront module is live.
                </span>
              </span>
            </label>
          </div>
        );
      })}
    </div>
  );
}
