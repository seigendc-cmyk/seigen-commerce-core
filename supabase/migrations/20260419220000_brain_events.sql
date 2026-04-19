-- Brain Event Foundation: append-only operational memory (raw facts).

create table if not exists public.brain_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  module text not null,
  tenant_id uuid references public.tenants (id) on delete set null,
  branch_id text,
  actor_id uuid,
  actor_type text not null default 'user' check (actor_type in ('user', 'system', 'integration')),
  entity_type text not null,
  entity_id text not null,
  occurred_at timestamptz not null default now(),
  severity text not null check (severity in ('debug', 'info', 'notice', 'warning', 'error', 'critical')),
  correlation_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists brain_events_occurred_at_idx on public.brain_events (occurred_at desc);
create index if not exists brain_events_tenant_occurred_idx on public.brain_events (tenant_id, occurred_at desc);
create index if not exists brain_events_module_idx on public.brain_events (module);
create index if not exists brain_events_event_type_idx on public.brain_events (event_type);
create index if not exists brain_events_correlation_idx on public.brain_events (correlation_id)
  where correlation_id is not null;

comment on table public.brain_events is 'Brain memory stream: immutable operational events for rules, alerts, and Console visibility.';

alter table public.brain_events enable row level security;

-- Emit: signed-in vendor staff only for their tenant (immutable rows).
create policy "brain_events_insert_tenant_member"
  on public.brain_events for insert
  to authenticated
  with check (
    tenant_id in (
      select tenant_id from public.tenant_members where user_id = (select auth.uid())
    )
  );

-- Read: authenticated users can list events (Console MVP). Tighten to console-operator role later.
create policy "brain_events_select_authenticated"
  on public.brain_events for select
  to authenticated
  using (true);

-- No update/delete — immutability enforced by omission of policies (service role bypasses RLS for admin tools).
