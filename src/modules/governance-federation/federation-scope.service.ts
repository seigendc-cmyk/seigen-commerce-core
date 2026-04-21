import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";
import type { FederationScopeRow, FederationScopeType } from "./types";

function mapScope(r: any): FederationScopeRow {
  return {
    id: String(r.id),
    tenantId: (r.tenant_id as string | null) ?? null,
    scopeType: r.scope_type as FederationScopeType,
    scopeCode: String(r.scope_code),
    title: String(r.title),
    parentScopeId: (r.parent_scope_id as string | null) ?? null,
    metadata: (r.metadata as any) ?? {},
    isPublic: Boolean(r.is_public),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export async function listFederationScopes(): Promise<{ ok: true; rows: FederationScopeRow[] } | { ok: false; error: string }> {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!user) return { ok: false, error: "Not signed in" };
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();

  // Tenant members can read tenant scopes; RLS also allows tenant_id null (public/system).
  const tenantId = ws?.tenant?.id ?? null;
  const q = supabase.from("federation_scopes").select("*").order("scope_type", { ascending: true }).order("scope_code", { ascending: true });
  if (tenantId) q.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);
  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  return { ok: true, rows: (data ?? []).map(mapScope) };
}

export async function upsertFederationScope(input: {
  scopeType: FederationScopeType;
  scopeCode: string;
  title: string;
  parentScopeId?: string | null;
  metadata?: Record<string, unknown>;
  isPublic?: boolean;
}): Promise<{ ok: true; row: FederationScopeRow } | { ok: false; error: string }> {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("federation_scopes")
    .upsert(
      {
        tenant_id: ws.tenant.id,
        scope_type: input.scopeType,
        scope_code: input.scopeCode,
        title: input.title,
        parent_scope_id: input.parentScopeId ?? null,
        metadata: input.metadata ?? {},
        is_public: Boolean(input.isPublic),
      },
      { onConflict: "tenant_id,scope_type,scope_code" },
    )
    .select("*")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Upsert failed" };
  return { ok: true, row: mapScope(data) };
}

export function buildScopeChain(input: {
  scopes: FederationScopeRow[];
  startScopeId: string;
  maxDepth?: number;
}): FederationScopeRow[] {
  const maxDepth = input.maxDepth ?? 20;
  const byId = new Map(input.scopes.map((s) => [s.id, s] as const));
  const out: FederationScopeRow[] = [];
  let cur = byId.get(input.startScopeId) ?? null;
  let guard = 0;
  while (cur && guard++ < maxDepth) {
    out.push(cur);
    cur = cur.parentScopeId ? byId.get(cur.parentScopeId) ?? null : null;
  }
  return out;
}

