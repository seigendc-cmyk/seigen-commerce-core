"use server";

import { revalidatePath } from "next/cache";
import { getPlanById, type PlanId } from "@/lib/plans";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ProvisionResult =
  | { ok: true; alreadyProvisioned: boolean }
  | { ok: false; error: string };

/**
 * Creates tenant, owner membership, and subscription row for the current auth user.
 * Idempotent: if membership already exists, returns success without duplicating rows.
 */
export async function provisionWorkspaceAfterSignup(input: {
  businessName: string;
  contactName: string;
  phone: string;
  planId: PlanId;
}): Promise<ProvisionResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return { ok: false, error: "You must be signed in to create a workspace." };
  }

  const { data: existing } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    return { ok: true, alreadyProvisioned: true };
  }

  const { data: tenant, error: tErr } = await supabase
    .from("tenants")
    .insert({
      name: input.businessName.trim() || "Untitled business",
      contact_name: input.contactName.trim() || null,
      phone: input.phone.trim() || null,
    })
    .select("id")
    .single();

  if (tErr || !tenant) {
    return { ok: false, error: tErr?.message ?? "Could not create workspace." };
  }

  const { error: mErr } = await supabase.from("tenant_members").insert({
    tenant_id: tenant.id,
    user_id: user.id,
    role: "owner",
  });

  if (mErr) {
    return { ok: false, error: mErr.message };
  }

  const { error: sErr } = await supabase.from("tenant_subscriptions").insert({
    tenant_id: tenant.id,
    plan_id: input.planId,
    /** Entitlements follow `plan_id` immediately; billing hooks can still drive this row later. */
    status: "active",
  });

  if (sErr) {
    return { ok: false, error: sErr.message };
  }

  return { ok: true, alreadyProvisioned: false };
}

export type ChangePlanResult = { ok: true } | { ok: false; error: string };

/**
 * Updates the signed-in user's workspace to a new commercial plan and marks the subscription active
 * so dashboard module gates immediately reflect {@link getPlanById} for that tier.
 */
export async function changeWorkspaceSubscriptionPlan(planId: PlanId): Promise<ChangePlanResult> {
  if (!getPlanById(planId)) {
    return { ok: false, error: "Unknown plan." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return { ok: false, error: "You must be signed in to change your plan." };
  }

  const { data: membership, error: memErr } = await supabase
    .from("tenant_members")
    .select("tenant_id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (memErr) {
    return { ok: false, error: memErr.message };
  }
  if (!membership) {
    return { ok: false, error: "No workspace found for this account. Complete signup first." };
  }

  if (membership.role !== "owner" && membership.role !== "admin") {
    return { ok: false, error: "Only workspace owners and admins can change the plan." };
  }

  const { data: existing, error: subSelectErr } = await supabase
    .from("tenant_subscriptions")
    .select("tenant_id")
    .eq("tenant_id", membership.tenant_id)
    .maybeSingle();

  if (subSelectErr) {
    return { ok: false, error: subSelectErr.message };
  }

  if (existing) {
    const { error: upErr } = await supabase
      .from("tenant_subscriptions")
      .update({ plan_id: planId, status: "active" })
      .eq("tenant_id", membership.tenant_id);
    if (upErr) {
      return { ok: false, error: upErr.message };
    }
  } else {
    const { error: insErr } = await supabase.from("tenant_subscriptions").insert({
      tenant_id: membership.tenant_id,
      plan_id: planId,
      status: "active",
    });
    if (insErr) {
      return { ok: false, error: insErr.message };
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/plans");
  return { ok: true };
}
