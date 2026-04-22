"use server";

import { randomUUID } from "node:crypto";
import {
  publishMarketListingForWorkspace,
  refreshMarketListingProjectionForWorkspace,
  unpublishMarketListingForWorkspace,
  type PublishMarketListingPayload,
  type PublishPipelineResult,
} from "@/modules/market-space/services/market-listing-publish.service";
import { resolveMarketSpaceWorkspaceContext } from "@/modules/market-space/server/workspace-context";

export async function publishMarketListingAction(
  payload: PublishMarketListingPayload,
): Promise<PublishPipelineResult | { ok: false; error: string }> {
  const ctx = await resolveMarketSpaceWorkspaceContext();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  return publishMarketListingForWorkspace(
    { supabase: ctx.supabase, tenantId: ctx.tenantId, userId: ctx.userId },
    payload,
    randomUUID(),
  );
}

export async function unpublishMarketListingAction(listingId: string, reason: string) {
  const ctx = await resolveMarketSpaceWorkspaceContext();
  if (!ctx.ok) return { ok: false as const, error: ctx.error };
  return unpublishMarketListingForWorkspace(
    { supabase: ctx.supabase, tenantId: ctx.tenantId, userId: ctx.userId },
    listingId,
    reason,
    randomUUID(),
  );
}

export async function refreshMarketListingProjectionAction(listingId: string, patch: Record<string, unknown>) {
  const ctx = await resolveMarketSpaceWorkspaceContext();
  if (!ctx.ok) return { ok: false as const, error: ctx.error };
  return refreshMarketListingProjectionForWorkspace(
    { supabase: ctx.supabase, tenantId: ctx.tenantId, userId: ctx.userId },
    listingId,
    patch,
    randomUUID(),
  );
}

export type { PublishMarketListingPayload };
