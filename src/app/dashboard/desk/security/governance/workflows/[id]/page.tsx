"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SecurityConsoleLayout } from "@/modules/rbac-admin/ui/security-console-layout";

async function fetchWorkflow(id: string) {
  const res = await fetch(`/api/governance/workflows/${id}`, { cache: "no-store" });
  return (await res.json()) as any;
}

export default function WorkflowDetailPage({ params }: { params: { id: string } }) {
  const id = params.id;
  const [bundle, setBundle] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const b = await fetchWorkflow(id);
      if (cancelled) return;
      setBundle(b);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <SecurityConsoleLayout>
      <div className="space-y-4">
        <Link href="/dashboard/desk/security/governance/workflows" className="text-sm text-neutral-400 hover:text-white">
          ← Back to workflows
        </Link>

        {!bundle?.ok ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6 text-sm text-neutral-300">{bundle?.error ?? "Loading…"}</div>
        ) : (
          <div className="space-y-6">
            <header className="vendor-panel-soft rounded-2xl p-6">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Workflow</div>
              <h1 className="mt-1 text-xl font-semibold text-white">{bundle.workflow.title}</h1>
              <div className="mt-2 grid gap-2 text-sm text-neutral-300 sm:grid-cols-2">
                <div>
                  <span className="text-neutral-500">Status: </span>
                  {bundle.workflow.status}
                </div>
                <div>
                  <span className="text-neutral-500">Risk: </span>
                  {bundle.workflow.riskLevel}
                </div>
                <div className="sm:col-span-2">
                  <span className="text-neutral-500">Origin: </span>
                  <span className="font-mono text-xs">{bundle.workflow.originPermissionKey}</span>
                </div>
                <div className="sm:col-span-2 text-xs text-neutral-500">
                  Visibility: {bundle.workflow.executiveVisible ? "Exec" : "—"} {bundle.workflow.trustVisible ? "· Trust" : ""}
                </div>
              </div>
            </header>

            <section className="vendor-panel-soft rounded-2xl p-6">
              <h2 className="text-base font-semibold text-white">Impact summary</h2>
              <pre className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-neutral-200">
                {JSON.stringify(bundle.workflow.impactSummaryJson ?? {}, null, 2)}
              </pre>
            </section>

            <section className="vendor-panel-soft rounded-2xl p-6">
              <h2 className="text-base font-semibold text-white">Linked artifacts</h2>
              <ul className="mt-3 space-y-2 text-sm text-neutral-300">
                {(bundle.links ?? []).length === 0 ? <li className="text-neutral-500">—</li> : null}
                {(bundle.links ?? []).map((l: any) => (
                  <li key={l.id} className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <div className="text-xs text-neutral-500">{l.linkType}</div>
                    <div className="mt-1 font-mono text-xs text-neutral-200">{l.linkedId}</div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="vendor-panel-soft rounded-2xl p-6">
              <h2 className="text-base font-semibold text-white">Timeline</h2>
              <ol className="mt-4 space-y-3 text-sm">
                {(bundle.timeline ?? []).length === 0 ? <li className="text-neutral-500">No events yet.</li> : null}
                {(bundle.timeline ?? []).map((e: any) => (
                  <li key={e.id} className="border-l border-white/15 pl-4 text-neutral-300">
                    <div className="text-xs text-neutral-500">{e.createdAt}</div>
                    <div className="font-semibold text-neutral-100">{e.title}</div>
                    <div className="text-neutral-400">{e.summary}</div>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        )}
      </div>
    </SecurityConsoleLayout>
  );
}

