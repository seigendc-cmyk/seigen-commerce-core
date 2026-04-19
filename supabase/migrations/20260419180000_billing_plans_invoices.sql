-- Billing: plan catalog (Supabase-backed prices), invoices, pending feature charges, activation codes, paid add-ons.

-- ---------------------------------------------------------------------------
-- Plan catalog (prices editable in DB; app merges with static plan metadata)
-- ---------------------------------------------------------------------------
create table if not exists public.billing_plan_catalog (
  plan_id text primary key,
  display_name text not null,
  monthly_amount_cents integer not null default 0,
  currency text not null default 'USD',
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Billable add-on features (replace / extend rows when product defines pricing)
-- ---------------------------------------------------------------------------
create table if not exists public.billable_features (
  feature_key text primary key,
  label text not null,
  description text,
  amount_cents integer not null,
  billing_kind text not null check (billing_kind in ('recurring_monthly', 'one_time')),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Invoices & lines
-- ---------------------------------------------------------------------------
create table if not exists public.vendor_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  status text not null check (status in ('open', 'paid', 'void')),
  cycle_start timestamptz,
  cycle_end timestamptz,
  currency text not null default 'USD',
  subtotal_cents integer not null default 0,
  total_cents integer not null default 0,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  notes text
);

create index if not exists vendor_invoices_tenant_id_idx on public.vendor_invoices (tenant_id);
create index if not exists vendor_invoices_status_idx on public.vendor_invoices (status);

create table if not exists public.vendor_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.vendor_invoices (id) on delete cascade,
  line_kind text not null check (line_kind in ('subscription', 'signup', 'feature_addon', 'adjustment')),
  description text not null,
  feature_key text,
  amount_cents integer not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists vendor_invoice_lines_invoice_id_idx on public.vendor_invoice_lines (invoice_id);

-- ---------------------------------------------------------------------------
-- Pending feature charges (must be accepted before they appear on an invoice)
-- ---------------------------------------------------------------------------
create table if not exists public.billing_pending_features (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  feature_key text not null,
  label text not null,
  amount_cents integer not null,
  status text not null check (status in ('pending', 'accepted', 'declined', 'invoiced', 'activated')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  invoice_line_id uuid references public.vendor_invoice_lines (id)
);

create index if not exists billing_pending_features_tenant_idx on public.billing_pending_features (tenant_id);

-- ---------------------------------------------------------------------------
-- Activation codes redeem against a specific invoice (issued by operations / SQL)
-- ---------------------------------------------------------------------------
create table if not exists public.activation_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  invoice_id uuid not null references public.vendor_invoices (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  amount_cents integer,
  status text not null check (status in ('issued', 'redeemed', 'void')),
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists activation_codes_tenant_idx on public.activation_codes (tenant_id);

-- ---------------------------------------------------------------------------
-- Paid add-on modules (applied after invoice paid; base plan still from tenant_subscriptions)
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_paid_addon_modules (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  feature_key text not null,
  granted_at timestamptz not null default now(),
  invoice_id uuid references public.vendor_invoices (id) on delete set null,
  primary key (tenant_id, feature_key)
);

-- ---------------------------------------------------------------------------
-- Seed plan prices (align with app marketing; adjust anytime in SQL)
-- ---------------------------------------------------------------------------
insert into public.billing_plan_catalog (plan_id, display_name, monthly_amount_cents, currency, sort_order)
values
  ('free', 'Free', 0, 'USD', 10),
  ('starter', 'Starter', 2900, 'USD', 20),
  ('lite-shop', 'Lite Shop', 5900, 'USD', 30),
  ('growth-pos', 'Growth POS', 9900, 'USD', 40),
  ('commerce-plus', 'Commerce Plus', 19900, 'USD', 50),
  ('multi-branch-retail', 'Multi-Branch Retail', 29900, 'USD', 60),
  ('distributor', 'Distributor', 34900, 'USD', 70),
  ('enterprise', 'Enterprise', 0, 'USD', 80)
on conflict (plan_id) do update set
  display_name = excluded.display_name,
  monthly_amount_cents = excluded.monthly_amount_cents,
  sort_order = excluded.sort_order,
  updated_at = now();

-- Placeholder billable add-ons (replace when you finalize feature list & pricing)
insert into public.billable_features (feature_key, label, description, amount_cents, billing_kind, active)
values
  ('api_integrations', 'API & integrations', 'Programmatic access and webhooks', 2500, 'recurring_monthly', true),
  ('multi_branch', 'Multi-branch expansion', 'Additional branch governance pack', 4900, 'recurring_monthly', true),
  ('online_storefront', 'Online storefront add-on', 'Customer-facing listings channel', 1500, 'recurring_monthly', true),
  ('reporting_advanced', 'Advanced analytics pack', 'Deeper roll-ups and exports', 1200, 'recurring_monthly', true),
  ('wholesale_b2b', 'Wholesale / B2B', 'Tier pricing and partner ordering', 1800, 'recurring_monthly', true)
on conflict (feature_key) do update set
  label = excluded.label,
  description = excluded.description,
  amount_cents = excluded.amount_cents,
  billing_kind = excluded.billing_kind,
  active = excluded.active,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Signup: first subscription row creates an open invoice (subscription line)
-- ---------------------------------------------------------------------------
create or replace function public.create_initial_subscription_invoice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  inv_id uuid;
  plan_cents integer;
  plan_label text;
begin
  select b.monthly_amount_cents, b.display_name
  into plan_cents, plan_label
  from public.billing_plan_catalog b
  where b.plan_id = new.plan_id;

  if not found then
    plan_cents := 0;
    plan_label := initcap(replace(new.plan_id, '-', ' '));
  end if;

  insert into public.vendor_invoices (tenant_id, status, cycle_start, cycle_end, currency, subtotal_cents, total_cents)
  values (
    new.tenant_id,
    'open',
    date_trunc('month', timezone('utc', now())),
    date_trunc('month', timezone('utc', now())) + interval '1 month',
    'USD',
    coalesce(plan_cents, 0),
    coalesce(plan_cents, 0)
  )
  returning id into inv_id;

  insert into public.vendor_invoice_lines (invoice_id, line_kind, description, feature_key, amount_cents)
  values (
    inv_id,
    'subscription',
    'Subscription — ' || plan_label,
    null,
    coalesce(plan_cents, 0)
  );

  return new;
end;
$$;

drop trigger if exists tenant_subscription_invoice_after_insert on public.tenant_subscriptions;
create trigger tenant_subscription_invoice_after_insert
  after insert on public.tenant_subscriptions
  for each row execute function public.create_initial_subscription_invoice();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.billing_plan_catalog enable row level security;
alter table public.billable_features enable row level security;
alter table public.vendor_invoices enable row level security;
alter table public.vendor_invoice_lines enable row level security;
alter table public.billing_pending_features enable row level security;
alter table public.activation_codes enable row level security;
alter table public.tenant_paid_addon_modules enable row level security;

-- Catalog readable to any signed-in user (pricing is not secret in-vendor UI)
create policy "billing_plan_catalog_select_auth"
  on public.billing_plan_catalog for select
  to authenticated
  using (true);

create policy "billable_features_select_auth"
  on public.billable_features for select
  to authenticated
  using (true);

create policy "vendor_invoices_select_member"
  on public.vendor_invoices for select
  using (
    tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()))
  );

create policy "vendor_invoices_update_owner"
  on public.vendor_invoices for update
  using (
    tenant_id in (
      select tenant_id from public.tenant_members
      where user_id = (select auth.uid()) and role in ('owner', 'admin')
    )
  );

create policy "vendor_invoices_insert_owner"
  on public.vendor_invoices for insert
  with check (
    tenant_id in (
      select tenant_id from public.tenant_members
      where user_id = (select auth.uid()) and role in ('owner', 'admin')
    )
  );

create policy "vendor_invoice_lines_select_member"
  on public.vendor_invoice_lines for select
  using (
    invoice_id in (
      select vi.id from public.vendor_invoices vi
      where vi.tenant_id in (
        select tenant_id from public.tenant_members where user_id = (select auth.uid())
      )
    )
  );

create policy "vendor_invoice_lines_insert_owner"
  on public.vendor_invoice_lines for insert
  with check (
    invoice_id in (
      select vi.id from public.vendor_invoices vi
      inner join public.tenant_members tm on tm.tenant_id = vi.tenant_id
      where tm.user_id = (select auth.uid()) and tm.role in ('owner', 'admin')
    )
  );

create policy "billing_pending_select_member"
  on public.billing_pending_features for select
  using (
    tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()))
  );

create policy "billing_pending_insert_owner"
  on public.billing_pending_features for insert
  with check (
    tenant_id in (
      select tenant_id from public.tenant_members
      where user_id = (select auth.uid()) and role in ('owner', 'admin')
    )
  );

create policy "billing_pending_update_owner"
  on public.billing_pending_features for update
  using (
    tenant_id in (
      select tenant_id from public.tenant_members
      where user_id = (select auth.uid()) and role in ('owner', 'admin')
    )
  );

create policy "activation_codes_select_member"
  on public.activation_codes for select
  using (
    tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()))
  );

create policy "activation_codes_update_owner"
  on public.activation_codes for update
  using (
    tenant_id in (
      select tenant_id from public.tenant_members
      where user_id = (select auth.uid()) and role in ('owner', 'admin')
    )
  );

create policy "tenant_paid_addon_select_member"
  on public.tenant_paid_addon_modules for select
  using (
    tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()))
  );

create policy "tenant_paid_addon_insert_owner"
  on public.tenant_paid_addon_modules for insert
  with check (
    tenant_id in (
      select tenant_id from public.tenant_members
      where user_id = (select auth.uid()) and role in ('owner', 'admin')
    )
  );

-- -----------------------------------------------------------------------------
-- Ops / SQL examples (not executed)
-- -----------------------------------------------------------------------------
-- Pending charge for a tenant (vendor accepts in Settings → Billing):
--   insert into public.billing_pending_features (tenant_id, feature_key, label, amount_cents, status)
--   values ('<tenant_uuid>', 'api_integrations', 'API & integrations', 2500, 'pending');
--
-- Issue activation code so the vendor can pay an open invoice:
--   insert into public.activation_codes (code, invoice_id, tenant_id, amount_cents, status)
--   values ('SEIGEN-XXXX-XXXX', '<invoice_uuid>', '<tenant_uuid>', 9900, 'issued');
--
-- Existing workspaces created before this migration have no invoice row; run a one-time
-- backfill or insert vendor_invoices + vendor_invoice_lines for those tenants if needed.
