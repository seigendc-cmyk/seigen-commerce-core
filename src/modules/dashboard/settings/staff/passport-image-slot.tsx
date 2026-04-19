"use client";

import { useCallback, useId, useState } from "react";
import { rasterImageFileToWebpDataUrl } from "@/modules/inventory/services/product-images";

const PASSPORT_ENCODE = { maxDimensionPx: 1920, quality: 0.82 as const };

function blockSensitivePreviewCopy(e: React.ClipboardEvent) {
  e.preventDefault();
}

type Props = {
  label: string;
  description?: string;
  value: string | null;
  onChange: (webpDataUrl: string | null) => void;
};

export function PassportImageSlot({ label, description, value, onChange }: Props) {
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onPick = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      setErr(null);
      setBusy(true);
      try {
        const dataUrl = await rasterImageFileToWebpDataUrl(file, PASSPORT_ENCODE);
        onChange(dataUrl);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Could not process image.");
      } finally {
        setBusy(false);
      }
    },
    [onChange],
  );

  return (
    <div className="space-y-2">
      <div>
        <label htmlFor={inputId} className="block text-sm font-medium text-neutral-200">
          {label}
        </label>
        {description ? <p className="mt-0.5 text-xs text-neutral-500">{description}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          disabled={busy}
          className="max-w-full text-xs text-neutral-300 file:mr-2 file:rounded file:border-0 file:bg-neutral-700 file:px-2 file:py-1 file:text-neutral-200"
          onChange={(e) => {
            void onPick(e.target.files);
            e.target.value = "";
          }}
        />
        {value ? (
          <button
            type="button"
            onClick={() => {
              setErr(null);
              onChange(null);
            }}
            className="text-xs font-medium text-red-400 hover:text-red-300"
          >
            Remove
          </button>
        ) : null}
      </div>
      {err ? <p className="text-xs text-red-400">{err}</p> : null}
      {busy ? <p className="text-xs text-neutral-500">Optimizing to WebP…</p> : null}
      {value ? (
        <>
          <div
            className="relative mt-2 overflow-hidden rounded-lg border border-white/10 bg-neutral-950/80 [&_*]:select-none"
            onCopy={blockSensitivePreviewCopy}
            onCut={blockSensitivePreviewCopy}
            onContextMenu={(e) => e.preventDefault()}
            style={{ userSelect: "none", WebkitUserSelect: "none" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- client-only data URL preview */}
            <img
              src={value}
              alt=""
              draggable={false}
              className="max-h-56 w-full object-contain"
              onContextMenu={(e) => e.preventDefault()}
              onDragStart={(e) => e.preventDefault()}
            />
          </div>
          <p className="text-[11px] leading-snug text-neutral-500">
            Stored in this session as optimized WebP. Preview blocks right-click save and drag; screen capture is still
            possible — use secure storage when HR connects uploads.
          </p>
        </>
      ) : null}
    </div>
  );
}
