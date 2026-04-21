"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  findProvisioningByAgentEmail,
  findProvisioningByAgentUserId,
  listProvisioningsByAgentEmail,
  listProvisioningsByAgentUserId,
  linkAgentUserToProvisioning,
} from "@/modules/consignment/services/consignment-agent-provisioning";
import { getActiveAgentAccessCodeForProvisioning, redeemAgentAccessCode } from "@/modules/consignment/services/consignment-agent-access-codes";
import { emitConsignmentAgentAccessCodeRedeemedBrainEvent } from "@/modules/brain/brain-actions";

export type AgentContext = {
  user: User;
  provisioningId: string;
  stallBranchId: string;
  agreementId: string;
  principalBranchId: string;
};

const LAST_AGENT_PROVISIONING_KEY = "seigen.agent.last_provisioning_id";

function readLastProvisioningId(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(LAST_AGENT_PROVISIONING_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeLastProvisioningId(id: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_AGENT_PROVISIONING_KEY, id);
  } catch {
    // ignore
  }
}

export function useAgentContext(): {
  loading: boolean;
  ctx: AgentContext | null;
  error: string | null;
} {
  const [loading, setLoading] = useState(true);
  const [ctx, setCtx] = useState<AgentContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ReturnType<typeof listProvisioningsByAgentEmail>>([]);

  useEffect(() => {
    let alive = true;
    async function run() {
      try {
        const supabase = createBrowserSupabaseClient();
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();
        if (!alive) return;
        if (userErr) {
          setError(userErr.message);
          setLoading(false);
          return;
        }
        if (!user) {
          setCtx(null);
          setLoading(false);
          return;
        }

        const linked = listProvisioningsByAgentUserId(user.id);
        const pendingByEmail = user.email ? listProvisioningsByAgentEmail(user.email) : [];
        const all = [...linked, ...pendingByEmail.filter((x) => !linked.some((l) => l.id === x.id))];
        if (all.length === 0) {
          setError("No Agent Stall is linked to this account yet. Ask the Vendor Admin to approve your agreement.");
          setCtx(null);
          setLoading(false);
          return;
        }

        // If multiple stalls exist, require explicit selection unless we have a saved selection.
        const last = readLastProvisioningId();
        const preferred =
          (last ? all.find((x) => x.id === last) : undefined) ??
          // Prefer a linked stall first, then most recent
          (linked[0] ?? all[0]);

        // If there are multiple candidates and no ctx selected yet, show chooser.
        if (all.length > 1 && !last) {
          setCandidates(all);
          setError("Multiple Agent Stalls found for this account. Select which stall you want to use.");
          setCtx(null);
          setLoading(false);
          return;
        }

        setCtx({
          user,
          provisioningId: preferred.id,
          stallBranchId: preferred.stallBranchId,
          agreementId: preferred.agreementId,
          principalBranchId: preferred.principalBranchId,
        });
        setCandidates([]);
        writeLastProvisioningId(preferred.id);
        setLoading(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load agent session.");
        setLoading(false);
      }
    }
    void run();
    return () => {
      alive = false;
    };
  }, []);

  return useMemo(() => ({ loading, ctx, error }), [loading, ctx, error]);
}

export function AgentGate({ children }: { children: (ctx: AgentContext) => React.ReactNode }) {
  const { loading, ctx, error } = useAgentContext();
  const [claimCode, setClaimCode] = useState("");
  const [claimStatus, setClaimStatus] = useState<string | null>(null);
  const [pickProvisioningId, setPickProvisioningId] = useState("");
  const [pickProvisionings, setPickProvisionings] = useState<
    Array<{
      id: string;
      agentName: string;
      agentEmail: string;
      status: string;
      stallBranchId: string;
      principalBranchId: string;
      agreementId: string;
    }>
  >([]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-700 shadow-sm">
        Loading agent session…
      </div>
    );
  }

  if (!ctx) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-700 shadow-sm">
        <div className="text-base font-semibold text-slate-900">Agent access</div>
        <p className="mt-2 text-slate-700">{error ?? "Please sign in to continue."}</p>
        {error?.toLowerCase().includes("multiple agent stalls") ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold text-slate-600">Select stall</div>
            <button
              type="button"
              className="mt-2 inline-flex rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
              onClick={async () => {
                const supabase = createBrowserSupabaseClient();
                const {
                  data: { user },
                } = await supabase.auth.getUser();
                if (!user || !user.email) return;
                const linked = listProvisioningsByAgentUserId(user.id);
                const pending = listProvisioningsByAgentEmail(user.email);
                const all = [...linked, ...pending.filter((x) => !linked.some((l) => l.id === x.id))];
                setPickProvisionings(all);
                setPickProvisioningId(all[0]?.id ?? "");
              }}
            >
              Load my stalls
            </button>

            {pickProvisionings.length > 0 ? (
              <>
                <select
                  className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  value={pickProvisioningId}
                  onChange={(e) => setPickProvisioningId(e.target.value)}
                >
                  {pickProvisionings.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.agentName} · {p.agentEmail} · {p.status}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="mt-3 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  onClick={() => {
                    if (!pickProvisioningId) return;
                    writeLastProvisioningId(pickProvisioningId);
                    window.location.reload();
                  }}
                >
                  Continue
                </button>
              </>
            ) : null}
          </div>
        ) : null}
        {error?.toLowerCase().includes("access code") ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold text-slate-600">Enter one-time Agent Access Code</div>
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
              value={claimCode}
              placeholder="e.g. 7KQ9-ABCD…"
              onChange={(e) => setClaimCode(e.target.value)}
            />
            {claimStatus ? <div className="mt-2 text-xs text-slate-600">{claimStatus}</div> : null}
            <button
              type="button"
              className="mt-3 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              onClick={async () => {
                try {
                  setClaimStatus(null);
                  const supabase = createBrowserSupabaseClient();
                  const {
                    data: { user },
                  } = await supabase.auth.getUser();
                  if (!user) {
                    setClaimStatus("Please sign in first.");
                    return;
                  }
                  // For multi-stall users: if a stall was selected, redeem against it; else fallback to first email match.
                  const selected = readLastProvisioningId();
                  const list = user.email ? listProvisioningsByAgentEmail(user.email) : [];
                  const p =
                    (selected ? list.find((x) => x.id === selected) : undefined) ??
                    (user.email ? findProvisioningByAgentEmail(user.email) : undefined);
                  if (!p) {
                    setClaimStatus("No provisioning found for this account.");
                    return;
                  }
                  const r = redeemAgentAccessCode({ code: claimCode, provisioningId: p.id, agentUserId: user.id });
                  if (!r.ok) {
                    setClaimStatus(r.error);
                    return;
                  }
                  void emitConsignmentAgentAccessCodeRedeemedBrainEvent({
                    provisioningId: p.id,
                    accessCodeId: r.accessCodeId,
                    principalBranchId: p.principalBranchId,
                    agentUserId: user.id,
                    correlationId: r.accessCodeId,
                  });
                  linkAgentUserToProvisioning({ provisioningId: p.id, agentUserId: user.id });
                  window.location.reload();
                } catch (e) {
                  setClaimStatus(e instanceof Error ? e.message : "Failed to claim code.");
                }
              }}
            >
              Claim stall
            </button>
          </div>
        ) : null}
        <div className="mt-4">
          <Link
            href="/signin"
            className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return <>{children(ctx)}</>;
}

