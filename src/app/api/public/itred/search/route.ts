import { NextResponse, type NextRequest } from "next/server";
import { readItredSearch } from "@/modules/market-space/services/public-market-read.service";
import { searchParamsToRecord } from "@/modules/market-space/server/search-params";

export const dynamic = "force-dynamic";

/** SOT §8 — same index as Market Space; geo-ranked when lat/lng/radius present. */
export async function GET(req: NextRequest) {
  const body = await readItredSearch(searchParamsToRecord(req));
  return NextResponse.json(body, {
    headers: {
      "x-seigen-public-api": "itred",
      "x-seigen-api-version": body.apiVersion ?? "0",
    },
  });
}
