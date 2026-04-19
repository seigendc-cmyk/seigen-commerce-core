-- Phase 2A: identity + commercial truth (tenants, membership, subscriptions)
-- Run in Supabase SQL editor or via supabase db push.

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  contact_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tenant_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create index if not exists tenant_members_user_id_idx on public.tenant_members (user_id);

create table if not exists public.tenant_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  plan_id text not null,
  status text not null check (
    status in ('active', 'pending_activation', 'inactive', 'cancelled')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id)
);

alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;
alter table public.tenant_subscriptions enable row level security;

-- Tenants: members can read their workspace
create policy "tenants_select_member"
  on public.tenants for select
  using (
    id in (
      select tenant_id from public.tenant_members where user_id = (select auth.uid())
    )
  );

-- Authenticated users can create a tenant (app enforces one workspace per user in Phase 2A)
create policy "tenants_insert_authenticated"
  on public.tenants for insert
  with check ((select auth.role()) = 'authenticated');

create policy "tenants_update_owner"
  on public.tenants for update
  using (
    id in (
      select tenant_id from public.tenant_members
      where user_id = (select auth.uid()) and role = 'owner'
    )
  );

-- Membership
create policy "tenant_members_select_self"
  on public.tenant_members for select
  using (user_id = (select auth.uid()));

create policy "tenant_members_insert_self"
  on public.tenant_members for insert
  with check (user_id = (select auth.uid()));

-- Subscriptions: readable by tenant members
create policy "tenant_subscriptions_select_member"
  on public.tenant_subscriptions for select
  using (
    tenant_id in (
      select tenant_id from public.tenant_members where user_id = (select auth.uid())
    )
  );

-- Owners can create the subscription row for their tenant (after tenant + membership exist)
create policy "tenant_subscriptions_insert_owner"
  on public.tenant_subscriptions for insert
  with check (
    tenant_id in (
      select tenant_id from public.tenant_members
      where user_id = (select auth.uid()) and role = 'owner'
    )
  );

create policy "tenant_subscriptions_update_owner"
  on public.tenant_subscriptions for update
  using (
    tenant_id in (
      select tenant_id from public.tenant_members
      where user_id = (select auth.uid()) and role = 'owner'
    )
  );
