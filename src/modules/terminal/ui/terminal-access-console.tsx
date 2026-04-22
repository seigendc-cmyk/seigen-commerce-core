"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { InventoryRepo } from "@/modules/inventory/services/inventory-repo";
import type { Id } from "@/modules/inventory/types/models";
import type { TerminalPortalType, TerminalProfile } from "../types/terminal-types";
import { DEFAULT_CASHIER_TERMINAL_PERMISSIONS } from "../types/terminal-types";
import {
  deleteTerminalProfile,
  listTerminalProfiles,
  terminalDbStorageKey,
  upsertTerminalProfile,
} from "../services/terminal-local-store";
import { hashTerminalPin } from "../services/terminal-pin";
import { generateTerminalAccessCode, isTerminalAccessCodeAvailable } from "../services/terminal-access-code";

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export type TerminalAccessConsoleContext = "desk-security" | "settings";

export type TerminalAccessConsoleProps = {
  /** Where the console is shown — only changes onboarding copy. */
  context?: TerminalAccessConsoleContext;
};

export function TerminalAccessConsole({ context = "desk-security" }: TerminalAccessConsoleProps) {
  const [profiles, setProfiles] = useState<TerminalProfile[]>([]);
  const [terminalCode, setTerminalCode] = useState("");
  const [operatorLabel, setOperatorLabel] = useState("");
  const [branchId, setBranchId] = useState<Id | "">("");
  const [requiresPin, setRequiresPin] = useState(true);
  const [pin, setPin] = useState("");
  const [portalType, setPortalType] = useState<TerminalPortalType>("cashier");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(() => setProfiles(listTerminalProfiles()), []);

  useEffect(() => {
    refresh();
    const on = () => refresh();
    window.addEventListener("seigen-terminal-profiles-updated", on);
    return () => window.removeEventListener("seigen-terminal-profiles-updated", on);
  }, [refresh]);

  const branches = useMemo(() => InventoryRepo.listBranches(), []);

  useEffect(() => {
    if (branchId || branches.length === 0) return;
    const trading =
      InventoryRepo.getDefaultTradingBranch() ?? InventoryRepo.getDefaultBranch() ?? branches[0];
    if (trading) setBranchId(trading.id);
  }, [branches, branchId]);

  async function createProfile(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      let code = terminalCode.trim();
      if (!code) {
        code = generateTerminalAccessCode();
        setTerminalCode(code);
      }
      if (!isTerminalAccessCodeAvailable(code)) {
        throw new Error("That access code is already in use. Generate a new one or pick a different code.");
      }
      if (!operatorLabel.trim()) throw new Error("Operator label is required.");
      if (!branchId) throw new Error("Pick a branch.");
      if (requiresPin && pin.trim().length < 4) throw new Error("PIN must be at least 4 digits.");

      const pinHash = requiresPin ? await hashTerminalPin(code, pin.trim()) : null;
      const row: TerminalProfile = {
        id: uid("tprof"),
        tenantId: "local",
        terminalCode: code,
        userId: null,
        branchId: branchId as Id,
        stallId: null,
        role: portalType,
        portalType,
        isActive: true,
        requiresPin,
        pinHash,
        permissions: [...DEFAULT_CASHIER_TERMINAL_PERMISSIONS],
        operatorLabel: operatorLabel.trim(),
        metadata: {},
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      upsertTerminalProfile(row);
      setTerminalCode("");
      setOperatorLabel("");
      setPin("");
      setMsg(
        `Created terminal “${row.terminalCode}”. Operators open /terminal/${encodeURIComponent(row.terminalCode)} or go to /terminal and enter the same code.`,
      );
      refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-white">Terminal access</h2>
        <p className="mt-1 max-w-2xl text-sm text-neutral-400">
          There is no built-in access code. Each code is defined here (or generated) when you create a profile. Data is
          stored locally in <code className="rounded bg-black/30 px-1">{terminalDbStorageKey()}</code> until Supabase
          sync is wired.
        </p>
        <ol className="mt-4 max-w-2xl list-decimal space-y-2 pl-5 text-sm text-neutral-300">
          <li>
            {context === "settings" ? (
              <>
                You are in{" "}
                <span className="font-semibold text-neutral-100">Dashboard → Settings → Terminal</span> (this tab). The
                same profiles also appear under Desk → Security → Terminal access.
              </>
            ) : (
              <>
                You are in{" "}
                <span className="font-semibold text-neutral-100">Dashboard → Desk → Security → Terminal access</span>.
              </>
            )}
          </li>
          <li>
            Create a profile and set an <span className="font-semibold text-neutral-100">access code</span> (e.g.{" "}
            <code className="rounded bg-black/30 px-1">FRONT-01</code>) or leave the field empty and submit to auto-generate
            a code. Use <span className="font-semibold text-neutral-100">Generate code</span> to fill the field without saving.
          </li>
          <li>
            Cashiers open{" "}
            <code className="rounded bg-black/30 px-1">/terminal/&lt;your-code&gt;</code> or go to{" "}
            <code className="rounded bg-black/30 px-1">/terminal</code> and enter the same code.
          </li>
        </ol>
        <p className="mt-3 max-w-2xl text-xs text-amber-200/90">
          If no profile exists yet, the mobile terminal will not resolve a code until you create one here.
        </p>
      </div>

      <form
        onSubmit={createProfile}
        className="vendor-panel-soft max-w-xl space-y-4 rounded-2xl p-5 text-sm text-neutral-200"
      >
        <div>
          <div className="flex items-end justify-between gap-2">
            <label className="text-xs font-medium text-neutral-400">Access code</label>
            <button
              type="button"
              className="text-xs font-semibold text-teal-400 hover:text-teal-300"
              onClick={() => setTerminalCode(generateTerminalAccessCode())}
            >
              Generate code
            </button>
          </div>
          <input
            className="vendor-field mt-1 w-full rounded-lg px-3 py-2"
            value={terminalCode}
            onChange={(e) => setTerminalCode(e.target.value)}
            placeholder="e.g. FRONT-01 — or leave blank to auto-generate on create"
          />
          <p className="mt-1 text-[11px] text-neutral-500">
            Codes are case-insensitive at login. Avoid spaces; use letters, numbers, and hyphens.
          </p>
        </div>
        <div>
          <label className="text-xs font-medium text-neutral-400">Operator display name</label>
          <input
            className="vendor-field mt-1 w-full rounded-lg px-3 py-2"
            value={operatorLabel}
            onChange={(e) => setOperatorLabel(e.target.value)}
            placeholder="Front counter · Mary"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-neutral-400">Branch / stall stock source</label>
          <select
            className="vendor-field mt-1 w-full rounded-lg px-3 py-2"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value as Id)}
          >
            <option value="">Select branch…</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-neutral-400">Portal type</label>
          <select
            className="vendor-field mt-1 w-full rounded-lg px-3 py-2"
            value={portalType}
            onChange={(e) => setPortalType(e.target.value as TerminalPortalType)}
          >
            <option value="cashier">Cashier</option>
            <option value="agent">Agent / stall</option>
            <option value="supervisor">Supervisor</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={requiresPin} onChange={(e) => setRequiresPin(e.target.checked)} />
          Require PIN at terminal
        </label>
        {requiresPin ? (
          <div>
            <label className="text-xs font-medium text-neutral-400">Set PIN</label>
            <input
              type="password"
              className="vendor-field mt-1 w-full rounded-lg px-3 py-2"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
          </div>
        ) : null}
        {msg ? <p className="text-xs text-amber-200">{msg}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Create terminal profile"}
        </button>
      </form>

      <div className="vendor-panel-soft rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-white">Existing profiles</h3>
        {profiles.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">
            No terminal profiles yet. Create one above — without a profile,{" "}
            <code className="rounded bg-black/20 px-1">/terminal/&lt;code&gt;</code> will not work.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-white/10">
            {profiles.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div>
                  <div className="font-semibold text-white">{p.terminalCode}</div>
                  <div className="text-xs text-teal-300/90">
                    URL: <code className="rounded bg-black/30 px-1">/terminal/{encodeURIComponent(p.terminalCode)}</code>
                  </div>
                  <div className="text-xs text-neutral-400">
                    {p.operatorLabel} · {p.portalType} · branch {p.branchId}
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded border border-red-500/40 px-2 py-1 text-xs font-semibold text-red-200 hover:bg-red-500/10"
                  onClick={() => {
                    deleteTerminalProfile(p.id);
                    refresh();
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
