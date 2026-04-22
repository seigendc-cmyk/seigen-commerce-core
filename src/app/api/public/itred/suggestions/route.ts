import { NextResponse, type NextRequest } from "next/server";
import { readItredSuggestions } from "@/modules/market-space/services/public-market-read.service";
import { searchParamsToRecord } from "@/modules/market-space/server/search-params";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const body = await readItredSuggestions(searchParamsToRecord(req));
  return NextResponse.json(body, {
    headers: {
      "x-seigen-public-api": "itred",
      "x-seigen-api-version": body.apiVersion ?? "0",
    },
  });
}
