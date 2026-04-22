"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function TerminalLandingPage() {
  const [code, setCode] = useState("");
  const router = useRouter();

  function go(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim();
    if (!c) return;
    router.push(`/terminal/${encodeURIComponent(c)}`);
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
        <div className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">seiGEN</div>
        <h1 className="mt-2 text-center text-2xl font-bold text-slate-900">Terminal access</h1>
        <p className="mt-1 text-center text-sm text-slate-500">Enter the access code from your SysAdmin.</p>
        <form onSubmit={go} className="mt-6 space-y-3">
          <label className="block text-xs font-medium text-slate-600" htmlFor="access-code">
            Access code
          </label>
          <input
            id="access-code"
            className="vendor-field w-full rounded-xl border border-slate-200 px-4 py-3 text-lg outline-none ring-orange-500/30 focus:ring-2"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="off"
            placeholder="e.g. FRONT-01"
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-orange-500 py-3 text-sm font-bold text-white shadow-md"
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  );
}
