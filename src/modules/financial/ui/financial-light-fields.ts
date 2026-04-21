/** Shared Tailwind classes for light, document-style CashBook modals (Receipt, Journal, Check writer). */
export const finLight = {
  backdrop: "bg-slate-900/45 backdrop-blur-[2px]",
  shell:
    "max-h-[94vh] w-full max-w-[min(96vw,84rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-2xl",
  title: "text-xl font-semibold tracking-tight text-slate-900",
  subtitle: "mt-1 max-w-xl text-sm text-slate-600",
  label: "text-xs font-semibold uppercase tracking-wide text-slate-500",
  field:
    "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/25",
  fieldMono: "font-mono",
  instrument:
    "relative overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-white px-5 py-6",
  glPanel: "rounded-xl border border-slate-200 bg-slate-50 px-5 py-5",
  balanceOk:
    "mt-5 grid gap-2 rounded-lg border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-slate-800",
  btnGhost: "rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400",
  btnPrimary:
    "rounded-lg bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-500/20 hover:bg-teal-700 disabled:opacity-40",
  err: "rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900",
} as const;
