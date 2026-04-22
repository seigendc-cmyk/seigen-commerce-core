import { NextResponse } from "next/server";
import { readMarketSpaceCategories } from "@/modules/market-space/services/public-market-read.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const body = await readMarketSpaceCategories();
  return NextResponse.json(body, {
    headers: {
      "x-seigen-public-api": "market-space",
      "x-seigen-api-version": body.apiVersion ?? "0",
    },
  });
}
