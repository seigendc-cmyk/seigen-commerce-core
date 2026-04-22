"use server";

import { randomUUID } from "node:crypto";
import {
  publishMarketListingForWorkspace,
  type PublishPipelineResult,
  type PublishMarketListingPayload,
} from "@/modules/market-space/services/market-listing-publish.service";
import { resolveMarketSpaceWorkspaceContext } from "@/modules/market-space/server/workspace-context";

async function resolveVendorAndStorefrontIds(ctx: { supabase: any; tenantId: string }): Promise<
  | { ok: true; vendor_id: string; storefront_id: string }
  | { ok: false; error: string }
> {
  try {
    const { data: vendorRow } = await ctx.supabase
      .from("public_vendors")
      .select("vendor_id, storefront_id")
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle();

    const vendor_id = String(vendorRow?.vendor_id ?? "").trim();
    const storefront_id = String(vendorRow?.storefront_id ?? "").trim();

    if (vendor_id && storefront_id) return { ok: true, vendor_id, storefront_id };

    // Fallback: keep the pipeline usable even before vendor/storefront provisioning is connected.
    return { ok: true, vendor_id: ctx.tenantId, storefront_id: ctx.tenantId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to resolve vendor/storefront ids." };
  }
}

/**
 * Internal publisher path: accepts an operationally-derived payload and publishes it via the existing projection pipeline.
 * Vendor/storefront IDs are resolved server-side to keep client-side operational truth local-first.
 */
export async function publishOperationalListingDraftAction(input: {
  payload: Omit<PublishMarketListingPayload, "vendor_id" | "storefront_id"> & {
    vendor_id?: string;
    storefront_id?: string;
  };
}): Promise<PublishPipelineResult | { ok: false; error: string }> {
  const ctx = await resolveMarketSpaceWorkspaceContext();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const ids = await resolveVendorAndStorefrontIds({ supabase: ctx.supabase, tenantId: ctx.tenantId });
  if (!ids.ok) return { ok: false, error: ids.error };

  const payload: PublishMarketListingPayload = {
    ...input.payload,
    vendor_id: ids.vendor_id,
    storefront_id: ids.storefront_id,
    publish_status: "draft",
    visible_in_market_space: false,
    visible_in_itred: false,
  };

  return publishMarketListingForWorkspace(
    { supabase: ctx.supabase, tenantId: ctx.tenantId, userId: ctx.userId },
    payload,
    randomUUID(),
  );
}

