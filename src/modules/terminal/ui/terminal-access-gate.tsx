"use client";

import { TerminalLoginCard } from "./terminal-login-card";

export function TerminalAccessGate() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-10">
      <div className="mb-6 text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-400">seiGEN</div>
        <h1 className="mt-2 text-2xl font-bold text-white">Terminal</h1>
        <p className="mt-1 text-sm text-slate-400">Cashier &amp; agent portal</p>
      </div>
      <TerminalLoginCard />
    </div>
  );
}
