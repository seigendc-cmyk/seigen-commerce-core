import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getDashboardWorkspace } from "@/lib/workspace/server";
import { getServerAuthUser } from "@/lib/auth/session";
import { renderDocument } from "./render-engine.service";

export async function generateAndRegisterDocument(input: {
  templateCode: string;
  packageType: string;
  title: string;
  subjectType: string;
  evidenceBundleId?: string | null;
  data: Record<string, unknown>;
}) {
  const ws = await getDashboardWorkspace();
  const user = await getServerAuthUser();
  if (!ws?.tenant?.id || !user) return { ok: false as const, error: "Not signed in / no workspace" };
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };

  const r = renderDocument({ templateCode: input.templateCode, title: input.title, subjectType: input.subjectType, data: input.data });
  if (!r.ok) return r;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("generated_document_packages")
    .insert({
      tenant_id: ws.tenant.id,
      evidence_bundle_id: input.evidenceBundleId ?? null,
      package_type: input.packageType,
      title: input.title,
      status: "generated",
      manifest_json: r.manifestJson,
      storage_path: null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false as const, error: error?.message ?? "Insert failed" };
  return { ok: true as const, packageId: data.id as string, html: r.html, manifestJson: r.manifestJson };
}

