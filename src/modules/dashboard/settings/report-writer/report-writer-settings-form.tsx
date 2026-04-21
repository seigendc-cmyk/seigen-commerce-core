"use client";

import { useCallback, useId, useMemo, useRef, useState } from "react";
import { useVendorBranches } from "@/modules/dashboard/settings/branches/vendor-branches-context";
import {
  DATE_RANGE_PRESETS,
  emptySavedLayout,
  MANAGEMENT_REPORT_TEMPLATES,
  REPORT_COLUMN_OPTIONS,
  scheduleLabel,
  type SavedReportLayout,
  type ScheduleFrequency,
} from "@/modules/dashboard/settings/report-writer/report-writer-types";

function layoutSummary(r: SavedReportLayout): string {
  const cols = r.columns.length;
  const sched = scheduleLabel(r.scheduleFrequency, r.scheduleDetail);
  return `${cols} column${cols === 1 ? "" : "s"} · ${sched}`;
}

export function ReportWriterSettingsForm() {
  const rootId = useId();
  const nextSeq = useRef(1);
  const { branches } = useVendorBranches();

  const [savedLayouts, setSavedLayouts] = useState<SavedReportLayout[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savedHint, setSavedHint] = useState<string | null>(null);

  const branchOptions = useMemo(() => {
    return [
      { id: "all", label: "All branches" },
      ...branches.map((b) => ({
        id: b.id,
        label: (b.shopName.trim() || "Unnamed shop") + (b.city.trim() ? ` — ${b.city.trim()}` : ""),
      })),
    ];
  }, [branches]);

  const upsertLayout = useCallback((id: string, patch: Partial<SavedReportLayout>) => {
    setSavedLayouts((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const addBlank = useCallback(() => {
    const id = `${rootId}-r${nextSeq.current++}`;
    setSavedLayouts((list) => [...list, emptySavedLayout(id)]);
    setExpandedId(id);
  }, [rootId]);

  const addFromTemplate = useCallback(
    (templateId: string) => {
      const t = MANAGEMENT_REPORT_TEMPLATES.find((x) => x.id === templateId);
      if (!t) return;
      const id = `${rootId}-r${nextSeq.current++}`;
      const row: SavedReportLayout = {
        ...emptySavedLayout(id),
        name: `${t.name} (copy)`,
        templateId,
        columns: [...t.defaultColumns],
      };
      setSavedLayouts((list) => [...list, row]);
      setExpandedId(id);
    },
    [rootId],
  );

  const removeLayout = useCallback((id: string) => {
    setSavedLayouts((list) => list.filter((r) => r.id !== id));
    setExpandedId((cur) => (cur === id ? null : cur));
  }, []);

  function handleSaveDraft(e: React.FormEvent) {
    e.preventDefault();
    setSavedHint("Layouts saved locally — scheduled runs and file generation connect when your reporting API is wired.");
    window.setTimeout(() => setSavedHint(null), 4000);
  }

  function runPlaceholder(name: string) {
    setSavedHint(`Report "${name}" queued — preview will open when the engine is connected.`);
    window.setTimeout(() => setSavedHint(null), 3500);
  }

  function exportPlaceholder(name: string, kind: "spreadsheet" | "pdf") {
    setSavedHint(
      kind === "spreadsheet"
        ? `Exporting "${name}" to spreadsheet — download will appear when export is supported.`
        : `Exporting "${name}" to PDF — download will appear when export is supported.`,
    );
    window.setTimeout(() => setSavedHint(null), 3500);
  }

  function toggleColumn(id: string, col: string, on: boolean) {
    setSavedLayouts((list) =>
      list.map((row) => {
        if (row.id !== id) return row;
        if (!on && row.columns.length === 1 && row.columns.includes(col)) return row;
        const set = new Set(row.columns);
        if (on) set.add(col);
        else set.delete(col);
        return {
          ...row,
          columns: Array.from(set).sort((a, b) => a.localeCompare(b)),
        };
      }),
    );
  }

  return (
    <form onSubmit={handleSaveDraft} className="space-y-6">
      <section className="vendor-panel rounded-2xl p-6">
        <h2 className="text-base font-semibold text-white">Report Writer</h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-300">
          Build <span className="text-neutral-100">management reports</span> from templates or from scratch. Save column
          sets, filters, and schedules, then run the same layout anytime. Exports to{" "}
          <span className="text-neutral-100">spreadsheet</span> or <span className="text-neutral-100">PDF</span> when your
          workspace enables them.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-neutral-400">
          <li>Saved layouts you can run again anytime.</li>
          <li>Pick columns and filters; schedule recurring exports.</li>
          <li>Export to spreadsheet or PDF when supported.</li>
        </ul>
      </section>

      <section className="vendor-panel rounded-2xl p-6">
        <h3 className="text-base font-semibold text-white">Templates</h3>
        <p className="mt-1 text-sm text-neutral-400">
          Start from a management report template, then customise columns and filters in your saved layout.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {MANAGEMENT_REPORT_TEMPLATES.map((t) => (
            <li
              key={t.id}
              className="flex flex-col rounded-xl border border-white/12 bg-white/[0.04] p-4"
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide text-teal-600/90">
                {t.category}
              </span>
              <span className="mt-1 font-medium text-white">{t.name}</span>
              <p className="mt-2 flex-1 text-xs leading-relaxed text-neutral-400">{t.description}</p>
              <button
                type="button"
                onClick={() => addFromTemplate(t.id)}
                className="mt-3 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/15"
              >
                Use template
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-white">Saved layouts</h3>
        <button
          type="button"
          onClick={addBlank}
          className="rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold text-white hover:border-teal-500 hover:text-teal-600"
        >
          New blank report
        </button>
      </div>

      {savedLayouts.length === 0 ? (
        <div className="vendor-empty rounded-2xl px-4 py-8 text-center text-sm text-neutral-400">
          No saved reports yet. Choose a template above or create a blank report.
        </div>
      ) : (
        <div className="space-y-3">
          {savedLayouts.map((r) => {
            const open = expandedId === r.id;
            return (
              <div
                key={r.id}
                className="overflow-hidden rounded-2xl border border-white/12 bg-white/[0.03]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setExpandedId(open ? null : r.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block text-sm font-medium text-white">{r.name}</span>
                    <span className="mt-0.5 block text-xs text-neutral-500">{layoutSummary(r)}</span>
                  </button>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => runPlaceholder(r.name)}
                      className="rounded-lg bg-teal-600/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-600"
                    >
                      Run
                    </button>
                    <button
                      type="button"
                      onClick={() => exportPlaceholder(r.name, "spreadsheet")}
                      className="rounded-lg border border-white/18 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:border-teal-500 hover:text-white"
                    >
                      Spreadsheet
                    </button>
                    <button
                      type="button"
                      onClick={() => exportPlaceholder(r.name, "pdf")}
                      className="rounded-lg border border-white/18 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:border-teal-500 hover:text-white"
                    >
                      PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedId(open ? null : r.id)}
                      className="text-xs font-semibold text-neutral-400 hover:text-white"
                    >
                      {open ? "Close" : "Edit"}
                    </button>
                  </div>
                </div>

                {open ? (
                  <div className="space-y-4 border-t border-white/10 px-4 py-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium text-neutral-200" htmlFor={`rw-name-${r.id}`}>
                          Report name
                        </label>
                        <input
                          id={`rw-name-${r.id}`}
                          value={r.name}
                          onChange={(e) => upsertLayout(r.id, { name: e.target.value })}
                          className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-200" htmlFor={`rw-branch-${r.id}`}>
                          Branch filter
                        </label>
                        <select
                          id={`rw-branch-${r.id}`}
                          value={r.branchScope}
                          onChange={(e) => upsertLayout(r.id, { branchScope: e.target.value })}
                          className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                        >
                          {branchOptions.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-neutral-200" htmlFor={`rw-date-${r.id}`}>
                        Date range
                      </label>
                      <select
                        id={`rw-date-${r.id}`}
                        value={r.dateRangePreset}
                        onChange={(e) => upsertLayout(r.id, { dateRangePreset: e.target.value })}
                        className="vendor-field mt-1 w-full max-w-md rounded-lg px-3 py-2 text-sm"
                      >
                        {DATE_RANGE_PRESETS.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-neutral-200">Columns</p>
                      <p className="mt-1 text-xs text-neutral-500">Select fields to include in the management report.</p>
                      <div className="mt-3 grid max-h-48 grid-cols-2 gap-2 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-3 sm:grid-cols-3">
                        {REPORT_COLUMN_OPTIONS.map((col) => (
                          <label
                            key={col}
                            className="flex cursor-pointer items-center gap-2 text-xs text-neutral-200"
                          >
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 accent-teal-600"
                              checked={r.columns.includes(col)}
                              onChange={(e) => toggleColumn(r.id, col, e.target.checked)}
                            />
                            {col}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium text-neutral-200" htmlFor={`rw-sch-${r.id}`}>
                          Schedule exports
                        </label>
                        <select
                          id={`rw-sch-${r.id}`}
                          value={r.scheduleFrequency}
                          onChange={(e) =>
                            upsertLayout(r.id, { scheduleFrequency: e.target.value as ScheduleFrequency })
                          }
                          className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                        >
                          <option value="none">Not scheduled</option>
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-neutral-200" htmlFor={`rw-schd-${r.id}`}>
                          Schedule detail
                        </label>
                        <input
                          id={`rw-schd-${r.id}`}
                          value={r.scheduleDetail}
                          onChange={(e) => upsertLayout(r.id, { scheduleDetail: e.target.value })}
                          className="vendor-field mt-1 w-full rounded-lg px-3 py-2 text-sm"
                          placeholder="e.g. Mon 08:00 or Day 1 06:00"
                          disabled={r.scheduleFrequency === "none"}
                        />
                        <p className="mt-1 text-xs text-neutral-500">
                          {scheduleLabel(r.scheduleFrequency, r.scheduleDetail)}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-neutral-200">Export formats</p>
                      <div className="mt-2 flex flex-wrap gap-4">
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-200">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-teal-600"
                            checked={r.exportXlsx}
                            onChange={(e) => upsertLayout(r.id, { exportXlsx: e.target.checked })}
                          />
                          Spreadsheet (.xlsx)
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-200">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-teal-600"
                            checked={r.exportPdf}
                            onChange={(e) => upsertLayout(r.id, { exportPdf: e.target.checked })}
                          />
                          PDF
                        </label>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => removeLayout(r.id)}
                        className="text-xs font-semibold text-red-300/90 hover:text-red-200"
                      >
                        Delete layout
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-95"
        >
          Save layouts
        </button>
        {savedHint ? <p className="text-sm text-neutral-400">{savedHint}</p> : null}
      </div>
    </form>
  );
}
