import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { authorize } from "@/modules/authz/authorization.service";
import { insertStepUpEvent } from "./persistence";

function nowIso() {
  return new Date().toISOString();
}

function toHex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(s: string): Promise<string> {
  const data = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return toHex(hash);
}

export async function setSupervisorPasscodeSecret(input: { tenantId: string; userId: string; passcode: string; salt?: string }) {
  if (!isSupabaseConfigured()) return { ok: false as const, error: "Supabase not configured" };
  const passcode = input.passcode.trim();
  if (passcode.length < 4) return { ok: false as const, error: "Passcode must be at least 4 characters." };
  const salt = (input.salt ?? crypto.randomUUID()).replace(/-/g, "");
  const hash = await sha256Hex(`${salt}:${passcode}`);
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("supervisor_passcode_secrets").upsert(
    {
      tenant_id: input.tenantId,
      user_id: input.userId,
      hash_alg: "sha256",
      salt,
      passcode_hash: hash,
      is_active: true,
    },
    { onConflict: "tenant_id,user_id" },
  );
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function verifySupervisorPasscode(input: {
  tenantId: string;
  requestingUserId: string;
  supervisorUserId: string;
  supervisorPasscode: string;
  permissionKey: string;
  actionCode: string;
  entityType: string;
  entityId: string | null;
  scopeEntityType?: any;
  scopeEntityId?: string;
  scopeCode?: string;
  reason?: string | null;
}): Promise<{ ok: true; stepUpEventId: string } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured" };
  if (input.requestingUserId === input.supervisorUserId) return { ok: false, error: "Self step-up is not allowed." };

  // Supervisor must have permission for governed action.
  const supAuth = await authorize({
    tenantId: input.tenantId,
    userId: input.supervisorUserId,
    permissionKey: input.permissionKey,
    scopeEntityType: input.scopeEntityType,
    scopeEntityId: input.scopeEntityId,
    scopeCode: input.scopeCode,
    critical: input.reason ? { reason: input.reason } : undefined,
  });
  if (!supAuth.allowed) return { ok: false, error: "Supervisor is not eligible for this action scope/permission." };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("supervisor_passcode_secrets")
    .select("salt, passcode_hash, is_active")
    .eq("tenant_id", input.tenantId)
    .eq("user_id", input.supervisorUserId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data || data.is_active !== true) return { ok: false, error: "Supervisor passcode not configured." };

  const attempt = input.supervisorPasscode.trim();
  if (!attempt) return { ok: false, error: "Passcode is required." };
  const computed = await sha256Hex(`${data.salt}:${attempt}`);
  if (computed !== data.passcode_hash) {
    const ev = await insertStepUpEvent({
      tenantId: input.tenantId,
      userId: input.requestingUserId,
      permissionKey: input.permissionKey,
      actionCode: input.actionCode,
      entityType: input.entityType,
      entityId: input.entityId,
      stepUpPolicyCode: "supervisor_passcode",
      status: "failed",
      metadata: { supervisorUserId: input.supervisorUserId, at: nowIso() },
    });
    return { ok: false, error: ev.ok ? "Invalid passcode." : "Invalid passcode." };
  }

  const ev = await insertStepUpEvent({
    tenantId: input.tenantId,
    userId: input.requestingUserId,
    permissionKey: input.permissionKey,
    actionCode: input.actionCode,
    entityType: input.entityType,
    entityId: input.entityId,
    stepUpPolicyCode: "supervisor_passcode",
    status: "completed",
    metadata: { supervisorUserId: input.supervisorUserId, at: nowIso() },
  });
  if (!ev.ok) return { ok: false, error: ev.error };
  return { ok: true, stepUpEventId: ev.id };
}

