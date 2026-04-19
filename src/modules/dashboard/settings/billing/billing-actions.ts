"use server";

import { revalidatePath } from "next/cache";
import { getPlanById, normalizePlanId, PLANS, type PlanId } from "@/lib/plans";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  BillingDashboardPayload,
  BillingDashboardUnavailable,
  BillableFeatureRow,
  BillingPendingFeatureRow,
  VendorInvoiceLineRow,
  VendorInvoiceRow,
} from "./billing-types";

export async function loadBillingDashboard(): Promise<BillingDashboardPayload | BillingDashboardUnavailable> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      reason: "not_configured",
      message: "Connect Supabase to load billing data, invoices, and activation codes.",
    };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return { ok: false, reason: "not_signed_in", message: "Sign in to view billing." };
    }

    const { data: membership } = await supabase
      .from("tenant_members")
      .select("tenant_id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!membership) {
      return {
        ok: false,
        reason: "no_workspace",
        message: "Complete workspace signup to manage billing and invoices.",
      };
    }

    const tenantId = membership.tenant_id as string;

    const [{ data: catalogRows, error: catErr }, { data: billableRows }, { data: sub }, { data: invRows }, { data: addonRows }] =
      await Promise.all([
        supabase.from("billing_plan_catalog").select("*").order("sort_order", { ascending: true }),
        supabase.from("billable_features").select("*").eq("active", true).order("feature_key"),
        supabase.from("tenant_subscriptions").select("plan_id").eq("tenant_id", tenantId).maybeSingle(),
        supabase.from("vendor_invoices").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
        supabase.from("tenant_paid_addon_modules").select("feature_key").eq("tenant_id", tenantId),
      ]);

    if (catErr?.code === "42P01" || catErr?.message?.includes("does not exist")) {
      return {
        ok: false,
        reason: "not_configured",
        message:
          "Billing tables are not installed. Run the Supabase migration (billing_plan_catalog, vendor_invoices, …).",
      };
    }

    const planId = normalizePlanId(sub?.plan_id as string | undefined);

    const catalog = (catalogRows ?? []) as Array<{
      plan_id: string;
      display_name: string;
      monthly_amount_cents: number;
      currency: string;
      sort_order: number;
    }>;

    const plans = catalog.map((row) => {
      const staticMeta = getPlanById(row.plan_id);
      return {
        planId: row.plan_id,
        displayName: row.display_name,
        monthlyAmountCents: row.monthly_amount_cents,
        currency: row.currency,
        purpose: staticMeta?.purpose ?? row.display_name,
        tagline: staticMeta?.tagline ?? "",
        highlights: staticMeta?.highlights ?? [],
        isCurrent: row.plan_id === planId,
      };
    });

    const plansOut =
      plans.length > 0
        ? plans
        : PLANS.map((p) => ({
            planId: p.id,
            displayName: p.name,
            monthlyAmountCents: 0,
            currency: "USD",
            purpose: p.purpose,
            tagline: p.tagline,
            highlights: p.highlights,
            isCurrent: p.id === planId,
          }));

    const invoices = (invRows ?? []) as VendorInvoiceRow[];
    const invoiceIds = invoices.map((i) => i.id);

    const linesByInvoiceId: Record<string, VendorInvoiceLineRow[]> = {};
    if (invoiceIds.length > 0) {
      const { data: lineRows } = await supabase
        .from("vendor_invoice_lines")
        .select("*")
        .in("invoice_id", invoiceIds)
        .order("created_at", { ascending: true });
      for (const ln of (lineRows ?? []) as VendorInvoiceLine[]) {
        const invId = ln.invoice_id;
        if (!linesByInvoiceId[invId]) linesByInvoiceId[invId] = [];
        linesByInvoiceId[invId].push(ln);
      }
    }

    const { data: pendingRows } = await supabase
      .from("billing_pending_features")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    type VendorInvoiceLine = VendorInvoiceLineRow;

    return {
      ok: true,
      tenantId,
      currentPlanId: planId,
      plans: plansOut,
      billableCatalog: (billableRows ?? []) as BillableFeatureRow[],
      invoices,
      linesByInvoiceId,
      pending: (pendingRows ?? []) as BillingPendingFeatureRow[],
      paidAddonKeys: (addonRows ?? []).map((r) => r.feature_key as string),
    };
  } catch (e) {
    return {
      ok: false,
      reason: "not_configured",
      message: e instanceof Error ? e.message : "Could not load billing data.",
    };
  }
}

async function getMembershipTenant(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>, userId: string) {
  const { data: membership } = await supabase
    .from("tenant_members")
    .select("tenant_id, role")
    .eq("user_id", userId)
    .maybeSingle();
  return membership as { tenant_id: string; role: string } | null;
}

async function recalculateInvoiceTotals(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  invoiceId: string,
) {
  const { data: lines } = await supabase.from("vendor_invoice_lines").select("amount_cents").eq("invoice_id", invoiceId);
  const total = (lines ?? []).reduce((s, r) => s + (r.amount_cents as number), 0);
  await supabase
    .from("vendor_invoices")
    .update({ subtotal_cents: total, total_cents: total })
    .eq("id", invoiceId);
}

export type BillingActionResult = { ok: true } | { ok: false; error: string };

/**
 * Accept a pending feature charge: adds a line to the current open invoice (or creates one).
 * Unpaid lines do not grant entitlements until the invoice is paid via activation code.
 */
export async function acceptPendingBillingFeature(pendingId: string): Promise<BillingActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase is not configured." };

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const membership = await getMembershipTenant(supabase, user.id);
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return { ok: false, error: "Only owners and admins can accept billing charges." };
  }

  const { data: pending, error: pErr } = await supabase
    .from("billing_pending_features")
    .select("*")
    .eq("id", pendingId)
    .eq("tenant_id", membership.tenant_id)
    .maybeSingle();

  if (pErr || !pending) return { ok: false, error: "Pending charge not found." };
  if (pending.status !== "pending") {
    return { ok: false, error: "This charge was already handled." };
  }

  let { data: openInv } = await supabase
    .from("vendor_invoices")
    .select("id")
    .eq("tenant_id", membership.tenant_id)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let invoiceId = openInv?.id as string | undefined;
  if (!invoiceId) {
    const start = new Date();
    const cycleStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    const cycleEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    const { data: inserted, error: iErr } = await supabase
      .from("vendor_invoices")
      .insert({
        tenant_id: membership.tenant_id,
        status: "open",
        cycle_start: cycleStart.toISOString(),
        cycle_end: cycleEnd.toISOString(),
        currency: "USD",
        subtotal_cents: 0,
        total_cents: 0,
      })
      .select("id")
      .single();
    if (iErr || !inserted) return { ok: false, error: iErr?.message ?? "Could not open an invoice." };
    invoiceId = inserted.id as string;
  }

  const { data: line, error: lErr } = await supabase
    .from("vendor_invoice_lines")
    .insert({
      invoice_id: invoiceId,
      line_kind: "feature_addon",
      description: `${pending.label} (add-on)`,
      feature_key: pending.feature_key,
      amount_cents: pending.amount_cents,
      meta: { pending_id: pendingId },
    })
    .select("id")
    .single();

  if (lErr || !line) return { ok: false, error: lErr?.message ?? "Could not add invoice line." };

  await recalculateInvoiceTotals(supabase, invoiceId);

  const { error: uErr } = await supabase
    .from("billing_pending_features")
    .update({
      status: "invoiced",
      responded_at: new Date().toISOString(),
      invoice_line_id: line.id as string,
    })
    .eq("id", pendingId);

  if (uErr) return { ok: false, error: uErr.message };

  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function declinePendingBillingFeature(pendingId: string): Promise<BillingActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase is not configured." };

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const membership = await getMembershipTenant(supabase, user.id);
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return { ok: false, error: "Only owners and admins can decline charges." };
  }

  const { error } = await supabase
    .from("billing_pending_features")
    .update({ status: "declined", responded_at: new Date().toISOString() })
    .eq("id", pendingId)
    .eq("tenant_id", membership.tenant_id)
    .eq("status", "pending");

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/settings");
  return { ok: true };
}

/**
 * Redeem an activation code to mark the linked invoice paid and activate paid feature lines.
 */
export async function redeemBillingActivationCode(rawCode: string): Promise<BillingActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase is not configured." };

  const code = rawCode.trim().toUpperCase().replace(/\s+/g, "");
  if (!code) return { ok: false, error: "Enter an activation code." };

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const membership = await getMembershipTenant(supabase, user.id);
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return { ok: false, error: "Only owners and admins can redeem activation codes." };
  }

  const { data: row, error: findErr } = await supabase
    .from("activation_codes")
    .select("*")
    .eq("code", code)
    .maybeSingle();

  if (findErr || !row) return { ok: false, error: "Invalid or unknown activation code." };
  if (row.status !== "issued") return { ok: false, error: "This code was already used or voided." };
  if (row.tenant_id !== membership.tenant_id) {
    return { ok: false, error: "This code does not belong to your workspace." };
  }

  const invoiceId = row.invoice_id as string;

  const { data: invoice } = await supabase.from("vendor_invoices").select("*").eq("id", invoiceId).maybeSingle();
  if (!invoice || invoice.tenant_id !== membership.tenant_id) {
    return { ok: false, error: "Invoice not found for this code." };
  }
  if (invoice.status === "paid") {
    return { ok: false, error: "This invoice is already paid." };
  }

  const expected = row.amount_cents as number | null;
  if (expected != null && invoice.total_cents != null && expected !== invoice.total_cents) {
    return { ok: false, error: "Activation code amount does not match this invoice. Contact support." };
  }

  const paidAt = new Date().toISOString();
  const { error: invErr } = await supabase
    .from("vendor_invoices")
    .update({ status: "paid", paid_at: paidAt })
    .eq("id", invoiceId)
    .eq("tenant_id", membership.tenant_id);

  if (invErr) return { ok: false, error: invErr.message };

  const { error: codeErr } = await supabase
    .from("activation_codes")
    .update({ status: "redeemed", redeemed_at: paidAt })
    .eq("id", row.id);

  if (codeErr) return { ok: false, error: codeErr.message };

  const { data: lines } = await supabase.from("vendor_invoice_lines").select("*").eq("invoice_id", invoiceId);

  for (const ln of lines ?? []) {
    const fk = ln.feature_key as string | null;
    if (ln.line_kind === "feature_addon" && fk) {
      await supabase.from("tenant_paid_addon_modules").upsert(
        {
          tenant_id: membership.tenant_id,
          feature_key: fk,
          invoice_id: invoiceId,
          granted_at: paidAt,
        },
        { onConflict: "tenant_id,feature_key" },
      );
    }
  }

  const lineIds = (lines ?? []).map((l) => l.id).filter(Boolean);
  if (lineIds.length > 0) {
    await supabase
      .from("billing_pending_features")
      .update({ status: "activated", responded_at: paidAt })
      .eq("tenant_id", membership.tenant_id)
      .eq("status", "invoiced")
      .in("invoice_line_id", lineIds);
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}
