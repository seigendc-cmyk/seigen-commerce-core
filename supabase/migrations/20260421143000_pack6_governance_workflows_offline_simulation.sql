-- Pack 6: Cross-module governance workflows + links/timeline + offline queue + simulation sessions

-- -----------------------------
-- 1) governance_workflows (workflow instances)
-- -----------------------------
create table if not exists public.governance_workflows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  workflow_code text not null,
  title text not null,
  description text null,
  origin_module_code text not null,
  origin_permission_key text not null,
  origin_action_code text not null,
  origin_entity_type text not null,
  origin_entity_id uuid null,
  requesting_user_id uuid not null references auth.users (id) on delete cascade,
  branch_id uuid null,
  warehouse_id uuid null,
  terminal_id uuid null,
  status text not null check (status in ('draft','pending','in_review','approved','rejected','partially_approved','executed','execution_failed','cancelled','closed')),
  risk_level text not null check (risk_level in ('low','medium','high','critical')),
  executive_visible boolean not null default false,
  trust_visible boolean not null default false,
  impact_summary_json jsonb not null default '{}'::jsonb,
  payload_json jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists governance_workflows_tenant_status_idx on public.governance_workflows (tenant_id, status, started_at desc);
create index if not exists governance_workflows_tenant_code_idx on public.governance_workflows (tenant_id, workflow_code, started_at desc);
create index if not exists governance_workflows_visibility_idx on public.governance_workflows (tenant_id, executive_visible, trust_visible, started_at desc);

drop trigger if exists governance_workflows_set_updated_at on public.governance_workflows;
create trigger governance_workflows_set_updated_at
before update on public.governance_workflows
for each row execute function public.set_updated_at();

comment on table public.governance_workflows is 'Pack 6: workflow fabric binding approvals/step-up/alerts/jobs across modules into a single governed timeline.';

-- -----------------------------
-- 2) governance_workflow_steps
-- -----------------------------
create table if not exists public.governance_workflow_steps (
  id uuid primary key default gen_random_uuid(),
  governance_workflow_id uuid not null references public.governance_workflows (id) on delete cascade,
  step_order integer not null,
  step_code text not null,
  step_type text not null check (step_type in ('approval','step_up','review','execution','notification','checkpoint','evidence')),
  module_code text not null,
  status text not null check (status in ('pending','in_progress','completed','failed','skipped','blocked')),
  assigned_to_user_id uuid null references auth.users (id) on delete set null,
  assigned_to_role_code text null,
  assigned_scope_json jsonb null,
  depends_on_step_id uuid null references public.governance_workflow_steps (id) on delete set null,
  payload_json jsonb not null default '{}'::jsonb,
  started_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  unique (governance_workflow_id, step_order)
);

create index if not exists governance_workflow_steps_workflow_idx on public.governance_workflow_steps (governance_workflow_id, step_order);

comment on table public.governance_workflow_steps is 'Pack 6: logical steps (not only approval stages) with dependencies for cross-module governance.';

-- -----------------------------
-- 3) governance_workflow_links
-- -----------------------------
create table if not exists public.governance_workflow_links (
  id uuid primary key default gen_random_uuid(),
  governance_workflow_id uuid not null references public.governance_workflows (id) on delete cascade,
  link_type text not null check (link_type in ('approval_request','step_up_event','alert','execution_job','audit_event','entity','recommendation')),
  linked_id text not null,
  linked_code text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists governance_workflow_links_workflow_idx on public.governance_workflow_links (governance_workflow_id, link_type, created_at desc);

comment on table public.governance_workflow_links is 'Pack 6: general-purpose link table binding workflow → approvals/step-up/alerts/jobs/entities.';

-- -----------------------------
-- 4) governance_workflow_timeline_events
-- -----------------------------
create table if not exists public.governance_workflow_timeline_events (
  id uuid primary key default gen_random_uuid(),
  governance_workflow_id uuid not null references public.governance_workflows (id) on delete cascade,
  event_code text not null,
  title text not null,
  summary text not null,
  actor_user_id uuid null references auth.users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists governance_workflow_timeline_idx on public.governance_workflow_timeline_events (governance_workflow_id, created_at asc);

comment on table public.governance_workflow_timeline_events is 'Pack 6: human-readable workflow history (mobile-friendly).';

-- -----------------------------
-- 5) governance_offline_queue (server-side optional mirror; primary queue is client local)
-- -----------------------------
create table if not exists public.governance_offline_queue (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  requesting_user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  temp_id text not null,
  payload_json jsonb not null default '{}'::jsonb,
  status text not null check (status in ('queued','synced','failed','discarded')),
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, requesting_user_id, temp_id)
);

drop trigger if exists governance_offline_queue_set_updated_at on public.governance_offline_queue;
create trigger governance_offline_queue_set_updated_at
before update on public.governance_offline_queue
for each row execute function public.set_updated_at();

comment on table public.governance_offline_queue is 'Pack 6: optional server mirror of offline-captured governance intents; authoritative decisions still require normal engine calls.';

-- -----------------------------
-- 6) governance_policy_simulations (optional persistence)
-- -----------------------------
create table if not exists public.governance_policy_simulations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  scenario_code text not null,
  title text not null,
  input_json jsonb not null default '{}'::jsonb,
  result_json jsonb not null default '{}'::jsonb,
  created_by_user_id uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.governance_policy_simulations is 'Pack 6: saved what-if scenarios for audit and comparison (simulation only; no live mutation).';

-- -----------------------------
-- 7) RLS
-- -----------------------------
alter table public.governance_workflows enable row level security;
alter table public.governance_workflow_steps enable row level security;
alter table public.governance_workflow_links enable row level security;
alter table public.governance_workflow_timeline_events enable row level security;
alter table public.governance_offline_queue enable row level security;
alter table public.governance_policy_simulations enable row level security;

drop policy if exists governance_workflows_select_member on public.governance_workflows;
create policy governance_workflows_select_member
  on public.governance_workflows for select
  to authenticated
  using (
    tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()))
  );

drop policy if exists governance_workflows_write_admin on public.governance_workflows;
create policy governance_workflows_write_admin
  on public.governance_workflows for update
  to authenticated
  using (
    tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin'))
  );

drop policy if exists governance_workflow_steps_select_member on public.governance_workflow_steps;
create policy governance_workflow_steps_select_member
  on public.governance_workflow_steps for select
  to authenticated
  using (
    exists (select 1 from public.governance_workflows w where w.id = governance_workflow_steps.governance_workflow_id and w.tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid())))
  );

drop policy if exists governance_workflow_links_select_member on public.governance_workflow_links;
create policy governance_workflow_links_select_member
  on public.governance_workflow_links for select
  to authenticated
  using (
    exists (select 1 from public.governance_workflows w where w.id = governance_workflow_links.governance_workflow_id and w.tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid())))
  );

drop policy if exists governance_workflow_timeline_select_member on public.governance_workflow_timeline_events;
create policy governance_workflow_timeline_select_member
  on public.governance_workflow_timeline_events for select
  to authenticated
  using (
    exists (select 1 from public.governance_workflows w where w.id = governance_workflow_timeline_events.governance_workflow_id and w.tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid())))
  );

drop policy if exists governance_offline_queue_select_owner on public.governance_offline_queue;
create policy governance_offline_queue_select_owner
  on public.governance_offline_queue for select
  to authenticated
  using (
    tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()))
    and requesting_user_id = (select auth.uid())
  );

drop policy if exists governance_offline_queue_insert_owner on public.governance_offline_queue;
create policy governance_offline_queue_insert_owner
  on public.governance_offline_queue for insert
  to authenticated
  with check (
    tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()))
    and requesting_user_id = (select auth.uid())
  );

drop policy if exists governance_policy_simulations_select_member on public.governance_policy_simulations;
create policy governance_policy_simulations_select_member
  on public.governance_policy_simulations for select
  to authenticated
  using (
    tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()))
  );

drop policy if exists governance_policy_simulations_insert_admin on public.governance_policy_simulations;
create policy governance_policy_simulations_insert_admin
  on public.governance_policy_simulations for insert
  to authenticated
  with check (
    tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin'))
  );

