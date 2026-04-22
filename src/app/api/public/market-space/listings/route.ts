import { NextResponse, type NextRequest } from "next/server";
import { readMarketSpaceListings } from "@/modules/market-space/services/public-market-read.service";
import { searchParamsToRecord } from "@/modules/market-space/server/search-params";

export const dynamic = "force-dynamic";

/** SOT §8 — filters: q, category, brand, city, suburb, province, country, minPrice, maxPrice, pickup, delivery, verifiedOnly, sort */
export async function GET(req: NextRequest) {
  const body = await readMarketSpaceListings(searchParamsToRecord(req));
  return NextResponse.json(body, {
    headers: {
      "x-seigen-public-api": "market-space",
      "x-seigen-api-version": body.apiVersion ?? "0",
    },
  });
}
