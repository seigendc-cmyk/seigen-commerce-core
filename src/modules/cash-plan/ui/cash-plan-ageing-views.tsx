"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AGEING_BUCKET_LABELS,
  type AgeingBucketId,
  buildCreditorsAgeingReport,
  buildDebtorsAgeingReport,
  buildDynamicCreditorsAgeingReport,
  buildDynamicDebtorsAgeingReport,
} from "@/modules/cash-plan/services/cash-plan-ageing";
import { listCreditorEntries } from "@/modules/financial/services/creditors-ledger";
import { listDebtorEntries } from "@/modules/financial/services/debtors-ledger";
import { defaultAgeingConfig, readAgeingConfig, writeAgeingConfig, type AgeingIntervalsConfig } from "@/modules/cash-plan/services/ageing-intervals";
import { downloadAgeingPdf } from "@/modules/cash-plan/services/cash-plan-ageing-pdf";

const BUCKET_ORDER: AgeingBucketId[] = ["not_yet_due", "d1_30", "d31_60", "d61_90", "d90_plus"];

function money(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function CashPlanCreditorsAgeingTab({ dataVersion }: { dataVersion: string }) {
  const [cfg, setCfg] = useState<AgeingIntervalsConfig>(() => readAgeingConfig("creditors"));
  useEffect(() => writeAgeingConfig("creditors", cfg), [cfg]);
  const dyn = useMemo(() => buildDynamicCreditorsAgeingReport(listCreditorEntries(2000), cfg), [dataVersion, cfg]);

  return (
    <section className="space-y-4 px-4 py-6 sm:px-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Creditors ageing (AP)</h2>
        <p className="mt-1 max-w-3xl text-sm text-neutral-400">
          Open supplier balances split by <strong className="text-neutral-300">invoice due date</strong>, with payments
          applied <strong className="text-neutral-300">FIFO</strong> against oldest invoices first. Same ledger data as
          Financial — nothing is posted from this view.
        </p>
      </div>
      <AgeingConfigBar kind="creditors" cfg={cfg} setCfg={setCfg} onDownloadPdf={() => {
        void downloadAgeingPdf({
          title: "Creditors ageing (AP)",
          entityLabel: "Supplier",
          bucketLabels: dyn.buckets.filter((b) => b.id !== "not_yet_due").map((b) => b.label).length
            ? [dyn.buckets[0]!.label, ...dyn.buckets.slice(1).map((b) => b.label)]
            : ["Not yet due", ...BUCKET_ORDER.map((k) => AGEING_BUCKET_LABELS[k])],
          rows: dyn.rows.map((r) => ({
            entityName: r.entityName,
            total: r.total,
            bucketValues: dyn.buckets.map((b) => r.buckets[b.id] ?? 0),
          })),
          filenameBase: "cashplan-creditors-ageing",
        });
      }} />
      <DynamicAgeingTable entityLabel="Supplier" buckets={dyn.buckets.map((b) => ({ id: b.id, label: b.label }))} rows={dyn.rows} />
    </section>
  );
}

export function CashPlanDebtorsAgeingTab({ dataVersion }: { dataVersion: string }) {
  const [cfg, setCfg] = useState<AgeingIntervalsConfig>(() => readAgeingConfig("debtors"));
  useEffect(() => writeAgeingConfig("debtors", cfg), [cfg]);
  const dyn = useMemo(() => buildDynamicDebtorsAgeingReport(listDebtorEntries(2000), cfg), [dataVersion, cfg]);

  return (
    <section className="space-y-4 px-4 py-6 sm:px-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Debtors ageing (AR)</h2>
        <p className="mt-1 max-w-3xl text-sm text-neutral-400">
          Customer balances split by due date with FIFO allocation of receipts. Mirrors your AR subledger; read-only.
        </p>
      </div>
      <AgeingConfigBar kind="debtors" cfg={cfg} setCfg={setCfg} onDownloadPdf={() => {
        void downloadAgeingPdf({
          title: "Debtors ageing (AR)",
          entityLabel: "Customer",
          bucketLabels: [dyn.buckets[0]!.label, ...dyn.buckets.slice(1).map((b) => b.label)],
          rows: dyn.rows.map((r) => ({
            entityName: r.entityName,
            total: r.total,
            bucketValues: dyn.buckets.map((b) => r.buckets[b.id] ?? 0),
          })),
          filenameBase: "cashplan-debtors-ageing",
        });
      }} />
      <DynamicAgeingTable entityLabel="Customer" buckets={dyn.buckets.map((b) => ({ id: b.id, label: b.label }))} rows={dyn.rows} />
    </section>
  );
}

function AgeingConfigBar({
  kind,
  cfg,
  setCfg,
  onDownloadPdf,
}: {
  kind: "creditors" | "debtors";
  cfg: AgeingIntervalsConfig;
  setCfg: (c: AgeingIntervalsConfig) => void;
  onDownloadPdf: () => void;
}) {
  const [boundariesText, setBoundariesText] = useState(() => cfg.boundaries.join(", "));
  const [maxText, setMaxText] = useState(() => (cfg.maxPeriod != null ? String(cfg.maxPeriod) : ""));

  useEffect(() => {
    setBoundariesText(cfg.boundaries.join(", "));
    setMaxText(cfg.maxPeriod != null ? String(cfg.maxPeriod) : "");
  }, [cfg.unit, cfg.boundaries, cfg.maxPeriod]);

  const unitLabel = cfg.unit === "days" ? "days" : cfg.unit === "weeks" ? "weeks" : "months";
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-xs text-neutral-400">
          Unit
          <select
            className="mt-1 w-[140px] rounded-lg border border-white/10 bg-neutral-950/40 px-3 py-2 text-sm text-neutral-100"
            value={cfg.unit}
            onChange={(e) => setCfg({ ...cfg, unit: e.target.value as any })}
          >
            <option value="days">Days</option>
            <option value="weeks">Weeks</option>
            <option value="months">Months</option>
          </select>
        </label>
        <label className="block text-xs text-neutral-400">
          Buckets (comma-separated boundaries)
          <input
            className="mt-1 w-[260px] rounded-lg border border-white/10 bg-neutral-950/40 px-3 py-2 text-sm text-neutral-100"
            value={boundariesText}
            onChange={(e) => {
              const v = e.target.value;
              setBoundariesText(v);
              const xs = v
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean)
                .map((x) => Number(x))
                .filter((n) => Number.isFinite(n) && n > 0);
              setCfg({ ...cfg, boundaries: xs });
            }}
            placeholder={cfg.unit === "days" ? "30, 60, 90" : cfg.unit === "weeks" ? "4, 8, 12" : "1, 2, 3"}
          />
        </label>
        <label className="block text-xs text-neutral-400">
          Max period (optional, {unitLabel})
          <input
            className="mt-1 w-[180px] rounded-lg border border-white/10 bg-neutral-950/40 px-3 py-2 text-sm text-neutral-100"
            value={maxText}
            onChange={(e) => {
              const v = e.target.value;
              setMaxText(v);
              const n = Math.floor(Number(v));
              setCfg({ ...cfg, maxPeriod: Number.isFinite(n) && n > 0 ? n : null });
            }}
            placeholder={cfg.unit === "days" ? "120" : cfg.unit === "weeks" ? "16" : "6"}
            inputMode="numeric"
          />
        </label>
        <button
          type="button"
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10"
          onClick={() => setCfg(defaultAgeingConfig())}
        >
          Reset default
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10"
          onClick={() => window.print()}
        >
          Print
        </button>
        <button
          type="button"
          className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-neutral-950 hover:bg-emerald-400"
          onClick={onDownloadPdf}
        >
          Download PDF
        </button>
      </div>
    </div>
  );
}

function AgeingTable({
  entityLabel,
  rows,
}: {
  entityLabel: string;
  rows: ReturnType<typeof buildCreditorsAgeingReport>;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-neutral-500">
        No open balances to age — creditor/debtor activity will appear here when the ledgers have outstanding amounts.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full min-w-[880px] text-left text-sm">
        <thead className="border-b border-white/10 bg-white/[0.04] text-xs font-semibold uppercase tracking-wide text-neutral-400">
          <tr>
            <th className="px-3 py-2">{entityLabel}</th>
            <th className="px-3 py-2 text-right">Total</th>
            {BUCKET_ORDER.map((k) => (
              <th key={k} className="px-3 py-2 text-right">
                {AGEING_BUCKET_LABELS[k]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.entityId} className="border-b border-white/[0.06] hover:bg-white/[0.03]">
              <td className="px-3 py-2 font-medium text-neutral-100">{r.entityName}</td>
              <td className="px-3 py-2 text-right font-mono text-white">{money(r.total)}</td>
              {BUCKET_ORDER.map((k) => (
                <td key={k} className="px-3 py-2 text-right font-mono text-neutral-300">
                  {money(r.buckets[k])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DynamicAgeingTable({
  entityLabel,
  buckets,
  rows,
}: {
  entityLabel: string;
  buckets: Array<{ id: string; label: string }>;
  rows: Array<{ entityId: string; entityName: string; total: number; buckets: Record<string, number> }>;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-neutral-500">
        No open balances to age — creditor/debtor activity will appear here when the ledgers have outstanding amounts.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full min-w-[920px] text-left text-sm">
        <thead className="border-b border-white/10 bg-white/[0.04] text-xs font-semibold uppercase tracking-wide text-neutral-400">
          <tr>
            <th className="px-3 py-2">{entityLabel}</th>
            <th className="px-3 py-2 text-right">Total</th>
            {buckets.map((b) => (
              <th key={b.id} className="px-3 py-2 text-right">
                {b.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.entityId} className="border-b border-white/[0.06] hover:bg-white/[0.03]">
              <td className="px-3 py-2 font-medium text-neutral-100">{r.entityName}</td>
              <td className="px-3 py-2 text-right font-mono text-white">{money(r.total)}</td>
              {buckets.map((b) => (
                <td key={b.id} className="px-3 py-2 text-right font-mono text-neutral-300">
                  {money(r.buckets[b.id] ?? 0)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
