import { NextResponse } from "next/server";
import { readMarketSpaceVendor } from "@/modules/market-space/services/public-market-read.service";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const body = await readMarketSpaceVendor(slug);
  return NextResponse.json(body, {
    headers: {
      "x-seigen-public-api": "market-space",
      "x-seigen-api-version": body.apiVersion ?? "0",
    },
  });
}
