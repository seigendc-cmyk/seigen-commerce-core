"use client";

import { actOnApprovalStage } from "@/modules/governance-approvals/approval-request.service";
import { patchOfflineItem, type OfflineQueueItem } from "./governance-offline-queue";

/**
 * Offline sync processor.
 * Honesty rule: never claim final approval unless server confirms.
 */
export async function syncOfflineQueueItem(item: OfflineQueueItem): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    patchOfflineItem(item.tempId, { status: "syncing", lastError: null });

    if (item.kind === "approval.stage_action") {
      const requestId = String(item.payload.requestId ?? "");
      const stageId = String(item.payload.stageId ?? "");
      const action = String(item.payload.action ?? "") as any;
      const comment = typeof item.payload.comment === "string" ? item.payload.comment : undefined;
      if (!requestId || !stageId || (action !== "approve" && action !== "reject")) throw new Error("Invalid offline approval payload.");

      const r: any = await actOnApprovalStage({ requestId, stageId, action, comment });
      if (!r?.ok) throw new Error(r?.error ?? "Sync failed");
      patchOfflineItem(item.tempId, { status: "synced" });
      return { ok: true };
    }

    // Unhandled kinds are kept queued
    patchOfflineItem(item.tempId, { status: "failed", lastError: "Unsupported offline kind." });
    return { ok: false, error: "Unsupported offline kind." };
  } catch (e: any) {
    patchOfflineItem(item.tempId, { status: "failed", lastError: String(e?.message ?? e) });
    return { ok: false, error: String(e?.message ?? e) };
  }
}

