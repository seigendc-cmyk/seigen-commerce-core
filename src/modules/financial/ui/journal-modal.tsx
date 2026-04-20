"use client";

import { useEffect, useMemo, useState } from "react";
import {
  appendBalancedJournalWithLedgers,
  COA_BANK_CODE,
  COA_CASH_CODE,
  type JournalLine,
} from "@/modules/financial/services/general-journal-ledger";
import {
  COA_UPDATED_EVENT,
  findCoaAccountByCode,
  listCoaPostingAccounts,
} from "@/modules/dashboard/settings/coa/coa-store";
import { WindowControls } from "@/components/ui/window-controls";
import { finLight } from "@/modules/financial/ui/financial-light-fields";

function money(n: number) {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type DraftLine = { accountCode: string; accountName: string; debit: string; credit: string };

function emptyLine(): DraftLine {
  return { accountCode: "", accountName: "", debit: "", credit: "" };
}

export function JournalModal({
  open,
  onClose,
  onPosted,
  tick,
}: {
  open: boolean;
  onClose: () => void;
  onPosted: () => void;
  tick: number;
}) {
  void tick;

  const [documentNumber, setDocumentNumber] = useState("");
  const [journalDate, setJournalDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [preparedBy, setPreparedBy] = useState("");
  const [narrative, setNarrative] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([emptyLine(), emptyLine()]);
  const [err, setErr] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [coaTick, setCoaTick] = useState(0);

  useEffect(() => {
    const onAny = () => setCoaTick((t) => t + 1);
    window.addEventListener(COA_UPDATED_EVENT, onAny);
    return () => window.removeEventListener(COA_UPDATED_EVENT, onAny);
  }, []);

  const coa = useMemo(() => {
    void coaTick;
    return listCoaPostingAccounts();
  }, [coaTick]);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setMinimized(false);
  }, [open]);

  const totals = useMemo(() => {
    let dr = 0;
    let cr = 0;
    for (const l of lines) {
      dr += Number(l.debit) || 0;
      cr += Number(l.credit) || 0;
    }
    const ddr = round2(dr);
    const ccr = round2(cr);
    return { dr: ddr, cr: ccr, balanced: ddr === ccr && ddr > 0 };
  }, [lines]);

  function submit() {
    setErr(null);
    const jl: JournalLine[] = lines
      .map((l) => ({
        accountCode: l.accountCode.trim(),
        accountName: l.accountName.trim(),
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
      }))
      .filter((l) => l.accountCode.length > 0);

    const head = narrative.trim() || "Journal entry";
    const meta = [
      documentNumber.trim() ? `#${documentNumber.trim()}` : null,
      journalDate.trim() ? journalDate.trim() : null,
      preparedBy.trim() ? preparedBy.trim() : null,
    ]
      .filter(Boolean)
      .join(" · ");

    const memo = meta ? `${head} · ${meta}` : head;

    const r = appendBalancedJournalWithLedgers({
      memo,
      source: "journal",
      lines: jl,
      documentNumber: documentNumber.trim() || undefined,
      businessDate: journalDate.trim().slice(0, 10) || undefined,
      preparedBy: preparedBy.trim() || undefined,
    });

    if (!r.ok) {
      setErr(r.error);
      return;
    }
    onPosted();
    onClose();
    setDocumentNumber("");
    setPreparedBy("");
    setNarrative("");
    setJournalDate(new Date().toISOString().slice(0, 10));
    setLines([emptyLine(), emptyLine()]);
  }

  if (!open) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${finLight.backdrop}`} role="dialog">
      <div className={finLight.shell}>
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-orange">General journal</p>
              <h2 className={finLight.title}>Journal entry</h2>
              <p className={finLight.subtitle}>
                Balanced double-entry. Use <span className="font-mono">{COA_CASH_CODE}</span> or{" "}
                <span className="font-mono">{COA_BANK_CODE}</span> on a line to move physical cash or bank; other lines
                post to the GL only.
              </p>
            </div>
            <WindowControls
              minimized={minimized}
              onMinimize={() => setMinimized(true)}
              onRestore={() => setMinimized(false)}
              onClose={onClose}
            />
          </div>
        </div>

        {minimized ? null : <div className="space-y-5 px-6 py-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-slate-700 sm:col-span-2">
              <span className={finLight.label}>Description / narrative</span>
              <input
                className={finLight.field}
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
                placeholder="e.g. Owner contribution, Period-end adjustment"
              />
            </label>
            <label className="block text-sm text-slate-700">
              <span className={finLight.label}>Document / reference #</span>
              <input
                className={`${finLight.field} ${finLight.fieldMono}`}
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                placeholder="e.g. JNL-2026-014"
              />
            </label>
            <label className="block text-sm text-slate-700">
              <span className={finLight.label}>Journal date</span>
              <input
                type="date"
                className={finLight.field}
                value={journalDate}
                onChange={(e) => setJournalDate(e.target.value)}
              />
            </label>
            <label className="block text-sm text-slate-700 sm:col-span-2">
              <span className={finLight.label}>Prepared by</span>
              <input
                className={finLight.field}
                value={preparedBy}
                onChange={(e) => setPreparedBy(e.target.value)}
                placeholder="Full name of person preparing the entry"
              />
            </label>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid grid-cols-[1fr_1fr_80px_80px] gap-2 text-[10px] font-semibold uppercase text-slate-500">
              <span>Code</span>
              <span>Name</span>
              <span className="text-right">Debit</span>
              <span className="text-right">Credit</span>
            </div>
            <div className="mt-2 space-y-2">
              {lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_1fr_80px_80px] gap-2">
                    {coa.length === 0 ? (
                      <>
                        <input
                          className={`${finLight.field} py-1.5 text-xs ${finLight.fieldMono}`}
                          placeholder="1010"
                          value={line.accountCode}
                          onChange={(e) => {
                            const next = [...lines];
                            next[idx] = { ...line, accountCode: e.target.value };
                            setLines(next);
                          }}
                        />
                        <input
                          className={`${finLight.field} py-1.5 text-xs`}
                          placeholder="Account name"
                          value={line.accountName}
                          onChange={(e) => {
                            const next = [...lines];
                            next[idx] = { ...line, accountName: e.target.value };
                            setLines(next);
                          }}
                        />
                      </>
                    ) : (
                      <>
                        <input
                          className={`${finLight.field} py-1.5 text-xs ${finLight.fieldMono}`}
                          placeholder="1010"
                          value={line.accountCode}
                          readOnly
                        />
                        <select
                          className={`${finLight.field} py-1.5 text-xs`}
                          value={line.accountCode || ""}
                          onChange={(e) => {
                            const code = e.target.value;
                            const account = findCoaAccountByCode(code);
                            const next = [...lines];
                            next[idx] = {
                              ...line,
                              accountCode: account?.code ?? code,
                              accountName: account?.name ?? "",
                            };
                            setLines(next);
                          }}
                        >
                          <option value="">Select account…</option>
                          {coa.map((a) => (
                            <option key={a.code} value={a.code}>
                              {a.code} · {a.name}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                  <input
                    className={`${finLight.field} py-1.5 text-right text-xs ${finLight.fieldMono}`}
                    placeholder="0"
                    value={line.debit}
                    onChange={(e) => {
                      const next = [...lines];
                      next[idx] = { ...line, debit: e.target.value };
                      setLines(next);
                    }}
                  />
                  <input
                    className={`${finLight.field} py-1.5 text-right text-xs ${finLight.fieldMono}`}
                    placeholder="0"
                    value={line.credit}
                    onChange={(e) => {
                      const next = [...lines];
                      next[idx] = { ...line, credit: e.target.value };
                      setLines(next);
                    }}
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              className="mt-3 text-sm font-semibold text-brand-orange hover:underline"
              onClick={() => setLines([...lines, emptyLine()])}
            >
              + Add line
            </button>

            <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-3 text-sm">
              <span className="text-slate-600">
                Total DR {money(totals.dr)} · Total CR {money(totals.cr)}
              </span>
              <span className={totals.balanced ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"}>
                {totals.balanced ? "Balanced" : "Out of balance"}
              </span>
            </div>
          </div>

          {err ? <div className={finLight.err}>{err}</div> : null}

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
            <button type="button" onClick={onClose} className={finLight.btnGhost}>
              Cancel
            </button>
            <button type="button" disabled={!totals.balanced} onClick={() => submit()} className={finLight.btnPrimary}>
              Post journal
            </button>
          </div>
        </div>}
      </div>
    </div>
  );
}
