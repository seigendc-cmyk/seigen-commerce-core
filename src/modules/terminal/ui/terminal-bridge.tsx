"use client";

import { TerminalAccessGate } from "./terminal-access-gate";
import { TerminalShell } from "./terminal-shell";
import { useTerminalSession } from "../state/terminal-session-context";

export function TerminalBridge({ children }: { children: React.ReactNode }) {
  const { loading, error, profile, session } = useTerminalSession();

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950 text-slate-200">
        <div className="h-10 w-10 animate-pulse rounded-full bg-orange-500/30" />
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-slate-950 px-6 text-center text-slate-200">
        <p className="text-lg font-semibold text-white">Cannot open terminal</p>
        <p className="mt-2 max-w-sm text-sm text-slate-400">{error}</p>
      </div>
    );
  }

  if (!profile) return null;

  if (!session) {
    if (profile.requiresPin) return <TerminalAccessGate />;
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950 text-sm text-slate-300">
        Preparing secure session…
      </div>
    );
  }

  return <TerminalShell>{children}</TerminalShell>;
}
