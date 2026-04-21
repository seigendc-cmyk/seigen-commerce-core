-- Pack 8: Policy lifecycle/versioning, compliance reviews, external compliance events, archive/retention, document rendering registry

-- -----------------------------
-- 1) Governance policies + versions
-- -----------------------------
create table if not exists public.governance_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid null references public.tenants (id) on delete cascade,
  policy_code text not null,
  policy_type text not null,
  title text not null,
  description text null,
  owning_module_code text not null,
  status text not null check (status in ('draft','in_review','approved','published','superseded','archived')),
  current_version_number integer not null default 0,
  is_system boolean not null default false,
  is_protected boolean not null default false,
  requires_approval boolean not null default true,
  requires_executive_visibility boolean not null default false,
  requires_trust_visibility boolean not null default false,
  created_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), policy_code)
);

drop trigger if exists governance_policies_set_updated_at on public.governance_policies;
create trigger governance_policies_set_updated_at
before update on public.governance_policies
for each row execute function public.set_updated_at();

create table if not exists public.governance_policy_versions (
  id uuid primary key default gen_random_uuid(),
  governance_policy_id uuid not null references public.governance_policies (id) on delete cascade,
  version_number integer not null,
  version_status text not null check (version_status in ('draft','submitted','approved','published','rejected','withdrawn','superseded')),
  change_summary text not null default '',
  policy_definition_json jsonb not null default '{}'::jsonb,
  effective_from timestamptz not null default now(),
  effective_to timestamptz null,
  submitted_by uuid null references auth.users (id) on delete set null,
  submitted_at timestamptz null,
  approved_by uuid null references auth.users (id) on delete set null,
  approved_at timestamptz null,
  published_by uuid null references auth.users (id) on delete set null,
  published_at timestamptz null,
  superseded_by_version_id uuid null references public.governance_policy_versions (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (governance_policy_id, version_number)
);

drop trigger if exists governance_policy_versions_set_updated_at on public.governance_policy_versions;
create trigger governance_policy_versions_set_updated_at
before update on public.governance_policy_versions
for each row execute function public.set_updated_at();

-- One published version per policy (enforced by partial unique index)
create unique index if not exists governance_policy_versions_one_published
  on public.governance_policy_versions (governance_policy_id)
  where version_status = 'published';

create table if not exists public.policy_change_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  governance_policy_id uuid not null references public.governance_policies (id) on delete cascade,
  from_version_id uuid null references public.governance_policy_versions (id) on delete set null,
  to_version_id uuid not null references public.governance_policy_versions (id) on delete cascade,
  requesting_user_id uuid not null references auth.users (id) on delete cascade,
  reason text not null,
  status text not null,
  linked_workflow_id uuid null references public.governance_workflows (id) on delete set null,
  linked_resolution_id uuid null references public.board_resolutions (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists policy_change_requests_set_updated_at on public.policy_change_requests;
create trigger policy_change_requests_set_updated_at
before update on public.policy_change_requests
for each row execute function public.set_updated_at();

create table if not exists public.policy_adoption_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  governance_policy_id uuid not null references public.governance_policies (id) on delete cascade,
  policy_version_id uuid not null references public.governance_policy_versions (id) on delete cascade,
  action_code text not null check (action_code in ('published','rolled_back','review_due','review_completed','superseded','archived')),
  summary text not null,
  actor_user_id uuid null references auth.users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists policy_adoption_events_policy_idx on public.policy_adoption_events (tenant_id, governance_policy_id, created_at desc);

-- -----------------------------
-- 2) Compliance reviews (cycles/instances/obligations)
-- -----------------------------
create table if not exists public.compliance_review_cycles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  review_code text not null,
  title text not null,
  description text null,
  review_type text not null,
  subject_type text not null,
  subject_id text null,
  schedule_rule text not null,
  owner_role_code text null,
  owner_user_id uuid null references auth.users (id) on delete set null,
  requires_evidence_bundle boolean not null default false,
  requires_resolution boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, review_code)
);

drop trigger if exists compliance_review_cycles_set_updated_at on public.compliance_review_cycles;
create trigger compliance_review_cycles_set_updated_at
before update on public.compliance_review_cycles
for each row execute function public.set_updated_at();

create table if not exists public.compliance_review_instances (
  id uuid primary key default gen_random_uuid(),
  compliance_review_cycle_id uuid not null references public.compliance_review_cycles (id) on delete cascade,
  due_at timestamptz not null,
  status text not null check (status in ('scheduled','open','in_review','completed','overdue','cancelled')),
  assigned_to_user_id uuid null references auth.users (id) on delete set null,
  assigned_role_code text null,
  summary text null,
  result_json jsonb not null default '{}'::jsonb,
  evidence_bundle_id uuid null references public.evidence_bundles (id) on delete set null,
  resolution_id uuid null references public.board_resolutions (id) on delete set null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists compliance_review_instances_set_updated_at on public.compliance_review_instances;
create trigger compliance_review_instances_set_updated_at
before update on public.compliance_review_instances
for each row execute function public.set_updated_at();

create index if not exists compliance_review_instances_due_idx on public.compliance_review_instances (due_at, status);

create table if not exists public.review_obligations (
  id uuid primary key default gen_random_uuid(),
  compliance_review_instance_id uuid not null references public.compliance_review_instances (id) on delete cascade,
  obligation_code text not null,
  title text not null,
  status text not null check (status in ('open','completed','skipped')),
  assigned_to_user_id uuid null references auth.users (id) on delete set null,
  due_at timestamptz null,
  completed_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists review_obligations_instance_idx on public.review_obligations (compliance_review_instance_id, status);

-- -----------------------------
-- 3) External compliance hooks
-- -----------------------------
create table if not exists public.external_compliance_adapters (
  id uuid primary key default gen_random_uuid(),
  adapter_code text not null unique,
  title text not null,
  description text null,
  is_active boolean not null default true,
  config_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists external_compliance_adapters_set_updated_at on public.external_compliance_adapters;
create trigger external_compliance_adapters_set_updated_at
before update on public.external_compliance_adapters
for each row execute function public.set_updated_at();

create table if not exists public.external_compliance_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  adapter_code text not null,
  event_type text not null,
  direction text not null check (direction in ('outbound','inbound')),
  status text not null check (status in ('pending','sent','acknowledged','failed','received','processed')),
  reference_code text null,
  payload_json jsonb not null default '{}'::jsonb,
  response_json jsonb null,
  related_case_id uuid null references public.compliance_cases (id) on delete set null,
  related_bundle_id uuid null references public.evidence_bundles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists external_compliance_events_set_updated_at on public.external_compliance_events;
create trigger external_compliance_events_set_updated_at
before update on public.external_compliance_events
for each row execute function public.set_updated_at();

create index if not exists external_compliance_events_tenant_idx on public.external_compliance_events (tenant_id, status, created_at desc);

-- -----------------------------
-- 4) Archive governance / retention
-- -----------------------------
create table if not exists public.archive_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid null references public.tenants (id) on delete cascade,
  policy_code text not null,
  subject_type text not null,
  retention_period_days integer not null,
  archive_after_days integer not null default 30,
  requires_legal_hold_check boolean not null default true,
  requires_executive_hold_check boolean not null default false,
  requires_trust_hold_check boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), policy_code)
);

drop trigger if exists archive_policies_set_updated_at on public.archive_policies;
create trigger archive_policies_set_updated_at
before update on public.archive_policies
for each row execute function public.set_updated_at();

create table if not exists public.archive_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  subject_type text not null,
  subject_id text not null,
  archive_policy_id uuid not null references public.archive_policies (id) on delete restrict,
  archive_status text not null check (archive_status in ('active','eligible','archived','on_hold','purge_pending','purged')),
  archived_at timestamptz null,
  purge_due_at timestamptz null,
  hold_reason text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, subject_type, subject_id)
);

drop trigger if exists archive_records_set_updated_at on public.archive_records;
create trigger archive_records_set_updated_at
before update on public.archive_records
for each row execute function public.set_updated_at();

create index if not exists archive_records_tenant_status_idx on public.archive_records (tenant_id, archive_status, updated_at desc);

create table if not exists public.retrieval_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  subject_type text not null,
  subject_id text not null,
  actor_user_id uuid null references auth.users (id) on delete set null,
  reason text not null,
  created_at timestamptz not null default now()
);

-- -----------------------------
-- 5) Document templates registry (rendering pipeline)
-- -----------------------------
create table if not exists public.document_templates (
  id uuid primary key default gen_random_uuid(),
  template_code text not null unique,
  title text not null,
  description text null,
  supported_subject_types text[] not null default '{}'::text[],
  template_version integer not null default 1,
  is_active boolean not null default true,
  definition_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists document_templates_set_updated_at on public.document_templates;
create trigger document_templates_set_updated_at
before update on public.document_templates
for each row execute function public.set_updated_at();

-- -----------------------------
-- 6) RLS
-- -----------------------------
alter table public.governance_policies enable row level security;
alter table public.governance_policy_versions enable row level security;
alter table public.policy_change_requests enable row level security;
alter table public.policy_adoption_events enable row level security;
alter table public.compliance_review_cycles enable row level security;
alter table public.compliance_review_instances enable row level security;
alter table public.review_obligations enable row level security;
alter table public.external_compliance_events enable row level security;
alter table public.archive_policies enable row level security;
alter table public.archive_records enable row level security;
alter table public.retrieval_audit_events enable row level security;
alter table public.document_templates enable row level security;

-- Select policies for tenant members (includes system/global tenant_id null)
drop policy if exists governance_policies_select_member on public.governance_policies;
create policy governance_policies_select_member
  on public.governance_policies for select
  to authenticated
  using (
    tenant_id is null
    or tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()))
  );

drop policy if exists governance_policies_write_admin on public.governance_policies;
create policy governance_policies_write_admin
  on public.governance_policies for all
  to authenticated
  using (
    tenant_id is not null
    and tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin'))
  )
  with check (
    tenant_id is not null
    and tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin'))
  );

-- Versions readable to members via policy membership; writes admin only
drop policy if exists governance_policy_versions_select_member on public.governance_policy_versions;
create policy governance_policy_versions_select_member
  on public.governance_policy_versions for select
  to authenticated
  using (
    exists (
      select 1 from public.governance_policies p
      where p.id = governance_policy_versions.governance_policy_id
        and (p.tenant_id is null or p.tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid())))
    )
  );

drop policy if exists governance_policy_versions_write_admin on public.governance_policy_versions;
create policy governance_policy_versions_write_admin
  on public.governance_policy_versions for all
  to authenticated
  using (
    exists (
      select 1 from public.governance_policies p
      where p.id = governance_policy_versions.governance_policy_id
        and p.tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin'))
    )
  )
  with check (
    exists (
      select 1 from public.governance_policies p
      where p.id = governance_policy_versions.governance_policy_id
        and p.tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin'))
    )
  );

drop policy if exists compliance_review_cycles_select_member on public.compliance_review_cycles;
create policy compliance_review_cycles_select_member
  on public.compliance_review_cycles for select
  to authenticated
  using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid())));

drop policy if exists compliance_review_cycles_write_admin on public.compliance_review_cycles;
create policy compliance_review_cycles_write_admin
  on public.compliance_review_cycles for all
  to authenticated
  using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin')))
  with check (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin')));

drop policy if exists archive_records_select_member on public.archive_records;
create policy archive_records_select_member
  on public.archive_records for select
  to authenticated
  using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid())));

drop policy if exists archive_records_write_admin on public.archive_records;
create policy archive_records_write_admin
  on public.archive_records for update
  to authenticated
  using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin')));

drop policy if exists external_compliance_events_select_member on public.external_compliance_events;
create policy external_compliance_events_select_member
  on public.external_compliance_events for select
  to authenticated
  using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid())));

drop policy if exists document_templates_select_member on public.document_templates;
create policy document_templates_select_member
  on public.document_templates for select
  to authenticated
  using (true);

