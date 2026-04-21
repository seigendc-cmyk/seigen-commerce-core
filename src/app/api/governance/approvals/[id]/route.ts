import { NextResponse } from "next/server";
import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";
import { authorizeForCurrentUser } from "@/modules/authz/authorization-guard";
import { getRequestBundle } from "@/modules/governance-approvals/approval-repo";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return NextResponse.json({ ok: false, error: "Not signed in / no workspace" }, { status: 401 });

  const can = await authorizeForCurrentUser({ permissionKey: "approval.history.view" });
  if (!can.allowed) return NextResponse.json({ ok: false, error: "Not permitted" }, { status: 403 });

  const b = await getRequestBundle(ws.tenant.id, id);
  if (!b) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, ...b });
}

