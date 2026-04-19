"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getPlanById, type PlanId } from "@/lib/plans";
import { provisionWorkspaceAfterSignup } from "@/lib/workspace/actions";
import {
  PENDING_WORKSPACE_PROVISION_KEY,
  type PendingWorkspaceProvision,
} from "@/lib/workspace/pending-provision";
import { useWorkspace } from "./workspace-context";

/**
 * After email confirmation, the user may have a session but no tenant yet.
 * Replays stored signup payload to run `provisionWorkspaceAfterSignup`.
 */
export function PendingProvisionSync() {
  const router = useRouter();
  const workspace = useWorkspace();

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    if (workspace?.tenant) return;

    let cancelled = false;

    async function run() {
      try {
        const raw = window.localStorage.getItem(PENDING_WORKSPACE_PROVISION_KEY);
        if (!raw) return;

        const supabase = createBrowserSupabaseClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;

        const payload = JSON.parse(raw) as PendingWorkspaceProvision;
        const plan = getPlanById(payload.planId)?.id;
        if (!plan) return;

        const res = await provisionWorkspaceAfterSignup({
          businessName: payload.businessName,
          contactName: payload.contactName,
          phone: payload.phone,
          planId: plan as PlanId,
        });

        if (cancelled) return;
        if (res.ok) {
          window.localStorage.removeItem(PENDING_WORKSPACE_PROVISION_KEY);
          router.refresh();
        }
      } catch {
        /* ignore */
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [router, workspace?.tenant]);

  return null;
}
