-- BI / automation rules: routable by domain (inventory, sales, staff, delivery, …).
-- Application reads these for advisories, schedules, and policy checks; optional sync from app UI.

create table if not exists public.bi_business_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  domain text not null check (domain in ('inventory', 'sales', 'staff', 'delivery', 'financial', 'other')),
  rule_key text not null,
  title text not null,
  description text,
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (tenant_id, rule_key)
);

create index if not exists bi_business_rules_tenant_domain_idx
  on public.bi_business_rules (tenant_id, domain);

comment on table public.bi_business_rules is 'Tenant-scoped business rules for BI, spot checks, approvals, and in-app advisories.';

alter table public.bi_business_rules enable row level security;

create policy "bi_business_rules_select_tenant_member"
  on public.bi_business_rules for select
  to authenticated
  using (
    tenant_id in (
      select tenant_id from public.tenant_members where user_id = (select auth.uid())
    )
  );

create policy "bi_business_rules_write_tenant_admin"
  on public.bi_business_rules for all
  to authenticated
  using (
    tenant_id in (
      select tenant_id from public.tenant_members
      where user_id = (select auth.uid())
        and role in ('owner', 'admin')
    )
  )
  with check (
    tenant_id in (
      select tenant_id from public.tenant_members
      where user_id = (select auth.uid())
        and role in ('owner', 'admin')
    )
  );
