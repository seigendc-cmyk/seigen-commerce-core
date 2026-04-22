import type { NextRequest } from "next/server";

export function searchParamsToRecord(req: NextRequest): Record<string, string | string[] | undefined> {
  const out: Record<string, string | string[] | undefined> = {};
  req.nextUrl.searchParams.forEach((v, k) => {
    const cur = out[k];
    if (cur === undefined) out[k] = v;
    else if (Array.isArray(cur)) cur.push(v);
    else out[k] = [cur as string, v];
  });
  return out;
}
