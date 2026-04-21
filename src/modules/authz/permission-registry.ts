import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { PermissionMeta } from "./types";

type PermissionRow = {
  id: string;
  permission_key: string;
  label: string;
  description: string | null;
  module_code: string;
  category_code: string;
  resource_code: string;
  action_code: string;
  risk_level: "low" | "medium" | "high" | "critical";
  scope_type: "tenant" | "branch" | "warehouse" | "terminal" | "desk";
  is_protected: boolean;
  is_destructive: boolean;
  is_approval_capable: boolean;
  is_active: boolean;
  metadata: Record<string, unknown>;
};

function mapPermissionRow(r: PermissionRow): PermissionMeta {
  return {
    id: r.id,
    permissionKey: r.permission_key,
    label: r.label,
    description: r.description,
    moduleCode: r.module_code,
    categoryCode: r.category_code,
    resourceCode: r.resource_code,
    actionCode: r.action_code,
    riskLevel: r.risk_level,
    scopeType: r.scope_type,
    isProtected: r.is_protected,
    isDestructive: r.is_destructive,
    isApprovalCapable: r.is_approval_capable,
    isActive: r.is_active,
    metadata: r.metadata ?? {},
  };
}

const metaCache = new Map<string, PermissionMeta>();

export async function getPermissionMeta(permissionKey: string): Promise<PermissionMeta | null> {
  if (metaCache.has(permissionKey)) return metaCache.get(permissionKey)!;
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("permissions")
    .select(
      "id, permission_key, label, description, module_code, category_code, resource_code, action_code, risk_level, scope_type, is_protected, is_destructive, is_approval_capable, is_active, metadata",
    )
    .eq("permission_key", permissionKey)
    .maybeSingle();
  if (error || !data) return null;
  const meta = mapPermissionRow(data as PermissionRow);
  metaCache.set(permissionKey, meta);
  return meta;
}

export async function loadPermissionMetaByKeys(permissionKeys: string[]): Promise<Record<string, PermissionMeta>> {
  const uniq = Array.from(new Set(permissionKeys)).filter(Boolean);
  const out: Record<string, PermissionMeta> = {};

  const missing: string[] = [];
  for (const k of uniq) {
    const cached = metaCache.get(k);
    if (cached) out[k] = cached;
    else missing.push(k);
  }
  if (missing.length === 0) return out;
  if (!isSupabaseConfigured()) return out;

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("permissions")
    .select(
      "id, permission_key, label, description, module_code, category_code, resource_code, action_code, risk_level, scope_type, is_protected, is_destructive, is_approval_capable, is_active, metadata",
    )
    .in("permission_key", missing);

  for (const row of (data ?? []) as PermissionRow[]) {
    const meta = mapPermissionRow(row);
    metaCache.set(meta.permissionKey, meta);
    out[meta.permissionKey] = meta;
  }
  return out;
}

