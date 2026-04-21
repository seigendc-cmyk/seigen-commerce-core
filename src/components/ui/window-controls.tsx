"use client";

import { useId } from "react";

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" className="opacity-90">
      <path d={d} fill="currentColor" />
    </svg>
  );
}

export function WindowControls({
  minimized,
  maximized,
  onMinimize,
  onMaximize,
  onRestore,
  onClose,
}: {
  minimized: boolean;
  maximized?: boolean;
  onMinimize: () => void;
  onMaximize?: () => void;
  onRestore: () => void;
  onClose: () => void;
}) {
  const labelId = useId();
  return (
    <div className="flex items-center gap-1" aria-labelledby={labelId}>
      <span id={labelId} className="sr-only">
        Window controls
      </span>
      {minimized ? (
        <button
          type="button"
          onClick={onRestore}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          title="Restore"
          aria-label="Restore"
        >
          <Icon d="M7 7h10v10H7z" />
        </button>
      ) : (
        <button
          type="button"
          onClick={onMinimize}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          title="Minimize"
          aria-label="Minimize"
        >
          <Icon d="M6 12.5h12v2H6z" />
        </button>
      )}
      {onMaximize ? (
        maximized ? (
          <button
            type="button"
            onClick={onRestore}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            title="Restore"
            aria-label="Restore"
          >
            <Icon d="M7 7h10v10H7z" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onMaximize}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            title="Maximize"
            aria-label="Maximize"
          >
            <Icon d="M5 5h14v14H5z M7 7v10h10V7z" />
          </button>
        )
      ) : null}
      <button
        type="button"
        onClick={onClose}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-rose-50 hover:text-rose-700"
        title="Close"
        aria-label="Close"
      >
        <Icon d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3z" />
      </button>
    </div>
  );
}

