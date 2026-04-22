-- Mobile Terminal Portal — profiles, sessions, audit (tenant-scoped)
-- Local-first dev can still use browser storage; this is the Supabase SOT when configured.

begin;

create table if not exists public.terminal_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  terminal_code text not null,
  user_id uuid null references auth.users (id) on delete set null,
  branch_id text not null,
  stall_id text null,
  role text not null default 'cashier',
  portal_type text not null default 'cashier' check (portal_type in ('cashier','agent','supervisor')),
  is_active boolean not null default true,
  requires_pin boolean not null default true,
  pin_hash text null,
  permissions text[] not null default '{}'::text[],
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, terminal_code)
);

drop trigger if exists terminal_profiles_set_updated_at on public.terminal_profiles;
create trigger terminal_profiles_set_updated_at
before update on public.terminal_profiles
for each row execute function public.set_updated_at();

create index if not exists terminal_profiles_tenant_idx on public.terminal_profiles (tenant_id, is_active, portal_type);
create index if not exists terminal_profiles_user_idx on public.terminal_profiles (tenant_id, user_id);

create table if not exists public.terminal_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  terminal_profile_id uuid not null references public.terminal_profiles (id) on delete cascade,
  user_id uuid null references auth.users (id) on delete set null,
  branch_id text not null,
  stall_id text null,
  started_at timestamptz not null default now(),
  ended_at timestamptz null,
  session_status text not null default 'active' check (session_status in ('active','ended','revoked')),
  device_info jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz not null default now()
);

create index if not exists terminal_sessions_profile_idx on public.terminal_sessions (tenant_id, terminal_profile_id, started_at desc);

create table if not exists public.terminal_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  terminal_profile_id uuid null references public.terminal_profiles (id) on delete set null,
  session_id uuid null references public.terminal_sessions (id) on delete set null,
  action_code text not null,
  actor_label text not null default 'terminal',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists terminal_audit_tenant_idx on public.terminal_audit_events (tenant_id, created_at desc);

alter table public.terminal_profiles enable row level security;
alter table public.terminal_sessions enable row level security;
alter table public.terminal_audit_events enable row level security;

do $$
begin
  execute 'drop policy if exists terminal_profiles_select_member on public.terminal_profiles';
  execute 'create policy terminal_profiles_select_member on public.terminal_profiles for select to authenticated using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid())))';
  execute 'drop policy if exists terminal_profiles_write_admin on public.terminal_profiles';
  execute 'create policy terminal_profiles_write_admin on public.terminal_profiles for all to authenticated using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in (''owner'',''admin''))) with check (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in (''owner'',''admin'')))';

  execute 'drop policy if exists terminal_sessions_select_member on public.terminal_sessions';
  execute 'create policy terminal_sessions_select_member on public.terminal_sessions for select to authenticated using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid())))';
  execute 'drop policy if exists terminal_sessions_write_admin on public.terminal_sessions';
  execute 'create policy terminal_sessions_write_admin on public.terminal_sessions for all to authenticated using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in (''owner'',''admin''))) with check (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in (''owner'',''admin'')))';

  execute 'drop policy if exists terminal_audit_select_member on public.terminal_audit_events';
  execute 'create policy terminal_audit_select_member on public.terminal_audit_events for select to authenticated using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid())))';
  execute 'drop policy if exists terminal_audit_write_admin on public.terminal_audit_events';
  execute 'create policy terminal_audit_write_admin on public.terminal_audit_events for insert to authenticated with check (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in (''owner'',''admin'')))';
end $$;

insert into public.permissions (key, name, description, is_approval_capable)
values
  ('terminal.sale.create', 'Terminal: Create sale', 'Complete sales from the mobile terminal portal.', false),
  ('terminal.sale.discount', 'Terminal: Apply discount', 'Apply line or basket discounts from terminal.', true),
  ('terminal.sale.price_override', 'Terminal: Override price', 'Override unit prices at terminal (governed).', true),
  ('terminal.sale.return', 'Terminal: Process return', 'Initiate/process returns from terminal.', true),
  ('terminal.receipt.reprint', 'Terminal: Reprint receipt', 'Reprint or resend receipts from terminal history.', false),
  ('terminal.shift.open', 'Terminal: Open shift', 'Open a terminal shift / till session.', false),
  ('terminal.shift.close', 'Terminal: Close shift', 'Close a terminal shift / till session.', false),
  ('terminal.cash.remit', 'Terminal: Cash remittance', 'Submit or confirm cash remittance flows from terminal.', true),
  ('terminal.profile.manage', 'Terminal: Manage profiles', 'Create and manage terminal access profiles.', true)
on conflict (key) do update
set name = excluded.name,
    description = excluded.description,
    is_approval_capable = excluded.is_approval_capable;

commit;
