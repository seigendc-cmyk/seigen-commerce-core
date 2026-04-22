"use client";

import { useState } from "react";
import { useTerminalSession } from "../state/terminal-session-context";

export function TerminalLoginCard() {
  const { authenticateWithPin, profile } = useTerminalSession();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await authenticateWithPin(pin);
    setBusy(false);
    if (!r.ok) setMsg(r.message);
    else setPin("");
  }

  if (!profile?.requiresPin) return null;

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900/90 p-5 shadow-xl backdrop-blur"
    >
      <h2 className="text-center text-lg font-semibold text-white">Enter PIN</h2>
      <p className="mt-1 text-center text-xs text-slate-400">Terminal {profile.terminalCode}</p>
      <label className="mt-4 block text-xs font-medium text-slate-300" htmlFor="term-pin">
        PIN
      </label>
      <input
        id="term-pin"
        type="password"
        inputMode="numeric"
        autoComplete="one-time-code"
        className="vendor-field mt-1 w-full rounded-xl border border-white/15 bg-slate-950 px-4 py-3 text-lg tracking-widest text-white outline-none ring-orange-500/40 focus:ring-2"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        disabled={busy}
      />
      {msg ? <p className="mt-2 text-center text-sm text-red-300">{msg}</p> : null}
      <button
        type="submit"
        disabled={busy || pin.trim().length === 0}
        className="mt-5 w-full rounded-xl bg-orange-500 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-900/30 disabled:opacity-40"
      >
        {busy ? "Checking…" : "Unlock terminal"}
      </button>
    </form>
  );
}
