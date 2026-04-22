"use server";

import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";
import type {
  ConsignmentDocumentLinkKind,
  ConsignmentDocumentLinkRow,
  ConsignmentDocumentLinkTargetType,
  ConsignmentDocumentRow,
  ConsignmentDocumentType,
} from "./types";
import { emitConsignmentDocumentValidatedBrainEvent } from "@/modules/brain/brain-actions";
import { validateDocumentRegistration } from "./consignment-evidence-validation";

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

async function requireCtx() {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const supabase = await createServerSupabaseClient();
  return { ok: true as const, ws, user, supabase };
}

function mapDocument(r: any): ConsignmentDocumentRow {
  return {
    id: String(r.id),
    tenantId: String(r.tenant_id),
    agreementId: (r.agreement_id as string | null) ?? null,
    consignmentId: (r.consignment_id as string | null) ?? null,
    settlementId: (r.settlement_id as string | null) ?? null,
    reconciliationId: (r.reconciliation_id as string | null) ?? null,
    documentType: r.document_type,
    documentStatus: r.document_status,
    referenceCode: (r.reference_code as string | null) ?? null,
    title: String(r.title ?? ""),
    storageKind: r.storage_kind,
    storageRef: (r.storage_ref as string | null) ?? null,
    metadata: (r.metadata as any) ?? {},
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function mapLink(r: any): ConsignmentDocumentLinkRow {
  return {
    id: String(r.id),
    tenantId: String(r.tenant_id),
    documentId: String(r.document_id),
    linkKind: r.link_kind,
    targetType: r.target_type,
    targetId: String(r.target_id),
    notes: String(r.notes ?? ""),
    createdAt: String(r.created_at),
  };
}

export async function registerConsignmentDocument(input: {
  agreementId?: string | null;
  consignmentId?: string | null;
  settlementId?: string | null;
  reconciliationId?: string | null;
  documentType: ConsignmentDocumentType;
  title: string;
  referenceCode?: string | null;
  storageKind?: "internal" | "external";
  storageRef?: string | null;
  metadata?: Record<string, unknown>;
  correlationId: string;
  /** For Brain emission */
  agentId: string;
  stallBranchId?: string | null;
  principalBranchId?: string | null;
}): Promise<Result<{ document: ConsignmentDocumentRow }>> {
  const ctx = await requireCtx();
  if (!ctx.ok) return ctx;
  const vr = validateDocumentRegistration({ documentType: input.documentType, title: input.title });
  if (!vr.ok) return { ok: false, error: vr.errors.join(" ") };

  const { data, error } = await ctx.supabase
    .from("consignment_documents")
    .insert({
      tenant_id: ctx.ws.tenant.id,
      agreement_id: input.agreementId ?? null,
      consignment_id: input.consignmentId ?? null,
      settlement_id: input.settlementId ?? null,
      reconciliation_id: input.reconciliationId ?? null,
      document_type: input.documentType,
      document_status: "active",
      reference_code: input.referenceCode ?? null,
      title: input.title.trim(),
      storage_kind: input.storageKind ?? "internal",
      storage_ref: input.storageRef ?? null,
      metadata: { ...(input.metadata ?? {}), registered_by: ctx.user.id },
      created_by: ctx.user.id as string,
    })
    .select("*")
    .single();
  if (error) return { ok: false, error: error.message };
  const document = mapDocument(data);

  void emitConsignmentDocumentValidatedBrainEvent({
    agentId: input.agentId,
    consignmentId: input.consignmentId ?? "agreement_scope",
    occurredAt: new Date().toISOString(),
    correlationId: input.correlationId,
    principalBranchId: input.principalBranchId ?? null,
    stallBranchId: input.stallBranchId ?? null,
    documentId: document.id,
    documentType: document.documentType,
    validationStatus: "registered",
    payload: { agreement_id: input.agreementId, settlement_id: input.settlementId, reconciliation_id: input.reconciliationId },
  });

  return { ok: true, value: { document } };
}

export async function createConsignmentDocumentLink(input: {
  documentId: string;
  linkKind: ConsignmentDocumentLinkKind;
  targetType: ConsignmentDocumentLinkTargetType;
  targetId: string;
  notes?: string;
  correlationId: string;
  agentId: string;
  consignmentId: string;
  stallBranchId?: string | null;
  principalBranchId?: string | null;
}): Promise<Result<{ link: ConsignmentDocumentLinkRow }>> {
  const ctx = await requireCtx();
  if (!ctx.ok) return ctx;

  const { data, error } = await ctx.supabase
    .from("consignment_document_links")
    .insert({
      tenant_id: ctx.ws.tenant.id,
      document_id: input.documentId,
      link_kind: input.linkKind,
      target_type: input.targetType,
      target_id: input.targetId,
      notes: input.notes ?? "",
    })
    .select("*")
    .single();
  if (error) return { ok: false, error: error.message };
  const link = mapLink(data);

  void emitConsignmentDocumentValidatedBrainEvent({
    agentId: input.agentId,
    consignmentId: input.consignmentId,
    occurredAt: new Date().toISOString(),
    correlationId: input.correlationId,
    principalBranchId: input.principalBranchId ?? null,
    stallBranchId: input.stallBranchId ?? null,
    documentId: input.documentId,
    documentType: "evidence_bundle",
    validationStatus: "link_created",
    payload: { link_id: link.id, target_type: input.targetType, target_id: input.targetId },
  });

  return { ok: true, value: { link } };
}

export async function listConsignmentDocumentsForScope(input: {
  agreementId?: string | null;
  consignmentId?: string | null;
  settlementId?: string | null;
  reconciliationId?: string | null;
  limit?: number;
}): Promise<Result<{ rows: ConsignmentDocumentRow[] }>> {
  const ctx = await requireCtx();
  if (!ctx.ok) return ctx;
  const limit = input.limit ?? 500;
  let q = ctx.supabase.from("consignment_documents").select("*").eq("tenant_id", ctx.ws.tenant.id);
  if (input.agreementId) q = q.eq("agreement_id", input.agreementId);
  if (input.consignmentId) q = q.eq("consignment_id", input.consignmentId);
  if (input.settlementId) q = q.eq("settlement_id", input.settlementId);
  if (input.reconciliationId) q = q.eq("reconciliation_id", input.reconciliationId);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(limit);
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: { rows: (data ?? []).map(mapDocument) } };
}

export async function listConsignmentDocumentLinksForDocument(documentId: string): Promise<Result<{ rows: ConsignmentDocumentLinkRow[] }>> {
  const ctx = await requireCtx();
  if (!ctx.ok) return ctx;
  const { data, error } = await ctx.supabase
    .from("consignment_document_links")
    .select("*")
    .eq("tenant_id", ctx.ws.tenant.id)
    .eq("document_id", documentId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return { ok: false, error: error.message };
  return { ok: true, value: { rows: (data ?? []).map(mapLink) } };
}
