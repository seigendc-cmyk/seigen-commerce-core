import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/brain/brain-actions", () => ({
  emitBrainEventForWorkspace: async () => ({ ok: true, skipped: true, reason: "mock" }),
}));

import { publishMarketListingForWorkspace } from "./market-listing-publish.service";

describe("market listing publish guardrails", () => {
  it("rejects published listings missing currency_code and stock_signal", async () => {
    const res = await publishMarketListingForWorkspace(
      { supabase: {} as any, tenantId: "t1", userId: "u1" },
      {
        vendor_id: "v1",
        branch_id: "b1",
        storefront_id: "s1",
        product_id: "p1",
        listing_slug: "my-item",
        title: "My item",
        public_price: 10,
        publish_status: "published" as any,
        country: "ZW",
        city: "Harare",
        visible_in_market_space: true,
      },
      "corr_1",
    );

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.validationErrors ?? []).toEqual(
        expect.arrayContaining(["currency_code_required", "stock_signal_required"]),
      );
    }
  });
});

