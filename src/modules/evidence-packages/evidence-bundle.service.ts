import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";
import { generateEvidencePackageDocument } from "./document-generator.service";

function nowIso() {
  return new Date().toISOString();
}

function nextBundleCode(): string {
  return `BND-${Date.now().toString(36).toUpperCase()}`;
}

export async function createEvidenceBundle(input: {
  bundleType: "audit_review" | "legal_review" | "case_review" | "board_pack" | "trust_pack" | "compliance_pack" | "workflow_pack";
  title: string;
  description?: string | null;
  originCaseId?: string | null;
  originWorkflowId?: string | null;
  originResolutionId?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("evidence_bundles")
    .insert({
      tenant_id: ws.tenant.id,
      bundle_code: nextBundleCode(),
      title: input.title,
      description: input.description ?? null,
      bundle_type: input.bundleType,
      origin_case_id: input.originCaseId ?? null,
      origin_workflow_id: input.originWorkflowId ?? null,
      origin_resolution_id: input.originResolutionId ?? null,
      status: "draft",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed" };
  return { ok: true, id: data.id as string };
}

export async function addEvidenceItem(input: {
  bundleId: string;
  itemType: string;
  linkedId: string;
  linkedCode?: string | null;
  title: string;
  summary: string;
  sortOrder?: number;
  metadata?: Record<string, unknown>;
}) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("evidence_bundle_items").insert({
    evidence_bundle_id: input.bundleId,
    item_type: input.itemType,
    linked_id: input.linkedId,
    linked_code: input.linkedCode ?? null,
    title: input.title,
    summary: input.summary,
    sort_order: input.sortOrder ?? 0,
    metadata: input.metadata ?? {},
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function getEvidenceBundle(bundleId: string) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const [{ data: bundle }, { data: items }] = await Promise.all([
    supabase.from("evidence_bundles").select("*").eq("tenant_id", ws.tenant.id).eq("id", bundleId).maybeSingle(),
    supabase.from("evidence_bundle_items").select("*").eq("evidence_bundle_id", bundleId).order("sort_order", { ascending: true }),
  ]);
  if (!bundle) return { ok: false as const, error: "Not found" };
  return { ok: true as const, bundle, items: items ?? [] };
}

export async function finalizeEvidenceBundle(bundleId: string) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("evidence_bundles").update({ status: "finalized", updated_at: nowIso() }).eq("tenant_id", ws.tenant.id).eq("id", bundleId);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function generateDocumentPackageFromBundle(input: { bundleId: string; packageType: string; title: string }) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();

  const { data: bundle } = await supabase.from("evidence_bundles").select("*").eq("tenant_id", ws.tenant.id).eq("id", input.bundleId).maybeSingle();
  if (!bundle) return { ok: false as const, error: "Bundle not found" };
  const { data: items } = await supabase.from("evidence_bundle_items").select("*").eq("evidence_bundle_id", input.bundleId).order("sort_order", { ascending: true });

  let caseRow: any = null;
  if (bundle.origin_case_id) {
    const { data } = await supabase.from("compliance_cases").select("*").eq("tenant_id", ws.tenant.id).eq("id", bundle.origin_case_id).maybeSingle();
    caseRow = data ?? null;
  }

  const doc = generateEvidencePackageDocument({ title: input.title, bundle, items: items ?? [], extra: { case: caseRow } });

  const { data: pkg, error } = await supabase
    .from("generated_document_packages")
    .insert({
      tenant_id: ws.tenant.id,
      evidence_bundle_id: input.bundleId,
      package_type: input.packageType,
      title: input.title,
      status: "generated",
      manifest_json: doc.manifestJson,
      storage_path: null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !pkg) return { ok: false as const, error: error?.message ?? "Insert package failed" };

  return { ok: true as const, packageId: pkg.id as string, html: doc.html, manifestJson: doc.manifestJson };
}

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";

function nowIso() {
  return new Date().toISOString();
}

function nextBundleCode(): string {
  return `BND-${Date.now().toString(36).toUpperCase()}`;
}

export async function createEvidenceBundle(input: {
  bundleType: "audit_review" | "legal_review" | "case_review" | "board_pack" | "trust_pack" | "compliance_pack" | "workflow_pack";
  title: string;
  description?: string | null;
  originCaseId?: string | null;
  originWorkflowId?: string | null;
  originResolutionId?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("evidence_bundles")
    .insert({
      tenant_id: ws.tenant.id,
      bundle_code: nextBundleCode(),
      title: input.title,
      description: input.description ?? null,
      bundle_type: input.bundleType,
      origin_case_id: input.originCaseId ?? null,
      origin_workflow_id: input.originWorkflowId ?? null,
      origin_resolution_id: input.originResolutionId ?? null,
      status: "draft",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed" };
  return { ok: true, id: data.id as string };
}

export async function addEvidenceItem(input: {
  bundleId: string;
  itemType: string;
  linkedId: string;
  linkedCode?: string | null;
  title: string;
  summary: string;
  sortOrder?: number;
  metadata?: Record<string, unknown>;
}) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("evidence_bundle_items").insert({
    evidence_bundle_id: input.bundleId,
    item_type: input.itemType,
    linked_id: input.linkedId,
    linked_code: input.linkedCode ?? null,
    title: input.title,
    summary: input.summary,
    sort_order: input.sortOrder ?? 0,
    metadata: input.metadata ?? {},
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function getEvidenceBundle(bundleId: string) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const [{ data: bundle }, { data: items }] = await Promise.all([
    supabase.from("evidence_bundles").select("*").eq("tenant_id", ws.tenant.id).eq("id", bundleId).maybeSingle(),
    supabase.from("evidence_bundle_items").select("*").eq("evidence_bundle_id", bundleId).order("sort_order", { ascending: true }),
  ]);
  if (!bundle) return { ok: false as const, error: "Not found" };
  return { ok: true as const, bundle, items: items ?? [] };
}

export async function finalizeEvidenceBundle(bundleId: string) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("evidence_bundles").update({ status: "finalized", updated_at: nowIso() }).eq("tenant_id", ws.tenant.id).eq("id", bundleId);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

