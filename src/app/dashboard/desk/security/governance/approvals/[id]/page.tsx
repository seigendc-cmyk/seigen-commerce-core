"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SecurityConsoleLayout } from "@/modules/rbac-admin/ui/security-console-layout";
import { actOnApprovalStage } from "@/modules/governance-approvals/approval-request.service";
import { finalizeReadyApprovalExecution } from "@/modules/governance-approvals/execution-finalizer.service";

async function fetchBundle(id: string) {
  const res = await fetch(`/api/governance/approvals/${id}`, { cache: "no-store" });
  return (await res.json()) as any;
}

export default function ApprovalDetailPage({ params }: { params: { id: string } }) {
  const id = params.id;
  const [bundle, setBundle] = useState<any>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [comment, setComment] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const b = await fetchBundle(id);
      if (cancelled) return;
      setBundle(b);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function act(stageId: string, action: "approve" | "reject") {
    setMsg(null);
    const r: any = await actOnApprovalStage({ requestId: id, stageId, action, comment });
    setMsg(r.ok ? `Action recorded: ${r.status}` : r.error);
    setBundle(await fetchBundle(id));
  }

  async function runFinalize() {
    setMsg(null);
    const r: any = await finalizeReadyApprovalExecution({ requestId: id });
    setMsg(r.ok ? "Execution completed." : r.error);
    setBundle(await fetchBundle(id));
  }

  return (
    <SecurityConsoleLayout>
      <div className="space-y-4">
        <Link href="/dashboard/desk/security/governance/approvals" className="text-sm text-neutral-400 hover:text-white">
          ← Back to queue
        </Link>

        {msg ? <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-neutral-200">{msg}</div> : null}

        {!bundle?.ok ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6 text-sm text-neutral-300">{bundle?.error ?? "Loading…"}</div>
        ) : (
          <div className="space-y-6">
            <header className="vendor-panel-soft rounded-2xl p-6">
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Approval request</div>
              <div className="mt-1 font-mono text-sm text-neutral-300">{bundle.request.id}</div>
              <div className="mt-3 grid gap-2 text-sm text-neutral-300 sm:grid-cols-2">
                <div>
                  <span className="text-neutral-500">Policy: </span>
                  {bundle.request.approvalPolicyCode}
                </div>
                <div>
                  <span className="text-neutral-500">Status: </span>
                  {bundle.request.status}
                </div>
                <div className="sm:col-span-2">
                  <span className="text-neutral-500">Permission: </span>
                  <span className="font-mono text-xs">{bundle.request.permissionKey}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-neutral-500">Reason: </span>
                  {bundle.request.reason ?? "—"}
                </div>
              </div>
            </header>

            <section className="vendor-panel-soft rounded-2xl p-6">
              <h3 className="text-base font-semibold text-white">Stages</h3>
              <div className="mt-3 space-y-3">
                {bundle.stages.map((s: any) => (
                  <div key={s.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-neutral-200">
                          Stage {s.stageOrder}: {s.stageCode}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {s.approverType} · role {s.approverRoleCode ?? "—"} · status {s.status}
                        </div>
                      </div>
                      {s.status === "pending" ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700" onClick={() => act(s.id, "approve")}>
                            Approve
                          </button>
                          <button className="rounded-lg bg-rose-600/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-600" onClick={() => act(s.id, "reject")}>
                            Reject
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <label className="block text-xs text-neutral-400">
                  <span className="mb-1 block font-medium text-neutral-300">Comment</span>
                  <input className="vendor-field w-full rounded-lg px-3 py-2 text-sm text-white" value={comment} onChange={(e) => setComment(e.target.value)} />
                </label>
              </div>
            </section>

            <section className="vendor-panel-soft rounded-2xl p-6">
              <h3 className="text-base font-semibold text-white">Execution</h3>
              <div className="mt-3 text-sm text-neutral-300">
                {bundle.jobs?.length ? (
                  <div className="space-y-2">
                    {bundle.jobs.map((j: any) => (
                      <div key={j.id} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
                        <div>
                          <span className="text-neutral-500">Handler: </span>
                          {j.handlerCode}
                        </div>
                        <div>
                          <span className="text-neutral-500">Status: </span>
                          {j.status}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  "—"
                )}
              </div>
              <div className="mt-4">
                <button className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700" onClick={runFinalize}>
                  Finalize execution
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </SecurityConsoleLayout>
  );
}

