"use client";

import { useState } from "react";
import { formatCopilotBoundaryNotice } from "@/modules/governance-copilot/copilot-explanation.service";
import { runCopilotQuery } from "@/modules/governance-copilot/copilot-query.service";

export function GovernanceCopilotPanel() {
  const notice = formatCopilotBoundaryNotice();
  const [mode, setMode] = useState<"explain" | "summarize" | "find" | "compare" | "suggest">("explain");
  const [queryText, setQueryText] = useState("");
  const [contextJson, setContextJson] = useState('{"policyCode":"","scopeChain":[]}');
  const [out, setOut] = useState<string>("");

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Governance copilot</div>
      <div className="mt-1 text-lg font-semibold text-white">{notice.title}</div>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-300">
        {notice.bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <label className="block text-xs text-neutral-400">
          Mode
          <select
            className="mt-1 w-full rounded-lg border border-white/10 bg-neutral-950/40 px-3 py-2 text-sm text-neutral-100"
            value={mode}
            onChange={(e) => setMode(e.target.value as any)}
          >
            <option value="explain">Explain</option>
            <option value="summarize">Summarize</option>
            <option value="find">Find</option>
            <option value="compare">Compare</option>
            <option value="suggest">Suggest</option>
          </select>
        </label>
        <label className="block text-xs text-neutral-400 sm:col-span-2">
          Query
          <input
            className="mt-1 w-full rounded-lg border border-white/10 bg-neutral-950/40 px-3 py-2 text-sm text-neutral-100"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder='e.g. "Which policy applies for Zimbabwe branch?"'
          />
        </label>
      </div>

      <label className="mt-2 block text-xs text-neutral-400">
        Context JSON (for explain/compare)
        <textarea
          className="mt-1 h-28 w-full rounded-lg border border-white/10 bg-neutral-950/40 px-3 py-2 font-mono text-xs text-neutral-100"
          value={contextJson}
          onChange={(e) => setContextJson(e.target.value)}
        />
      </label>

      <div className="mt-3 flex gap-2">
        <button
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
          onClick={async () => {
            setOut("");
            let ctx: any = {};
            try {
              ctx = JSON.parse(contextJson);
            } catch {
              ctx = {};
            }
            const res = await runCopilotQuery({ mode, queryText, contextJson: ctx });
            setOut(JSON.stringify(res, null, 2));
          }}
        >
          Run
        </button>
        <button
          className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-neutral-200 hover:bg-white/10"
          onClick={() => {
            setQueryText("");
            setOut("");
          }}
        >
          Clear
        </button>
      </div>

      {out ? (
        <pre className="mt-4 overflow-auto rounded-xl border border-white/10 bg-black/30 p-4 text-xs text-neutral-200">
          {out}
        </pre>
      ) : null}
    </div>
  );
}

