-- Pack 7: Compliance cases + evidence bundles + anomalies + board/trust resolutions
-- Formal governance operating layer. Tenant-scoped with RLS via tenant_members.

-- -----------------------------
-- 1) Compliance cases
-- -----------------------------
create table if not exists public.compliance_cases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  case_code text not null,
  case_type text not null check (
    case_type in (
      'compliance_exception','security_incident','policy_breach','audit_issue','financial_irregularity','delivery_dispute','consignment_dispute',
      'role_misuse','override_abuse','governance_exception','legal_review','board_matter'
    )
  ),
  title text not null,
  summary text not null,
  status text not null check (status in ('open','under_review','investigating','awaiting_response','escalated','resolved','closed','dismissed')),
  severity text not null check (severity in ('low','medium','high','critical')),
  origin_source_type text not null check (origin_source_type in ('workflow','alert','manual','anomaly','helpdesk','approval_request','audit')),
  origin_source_id text null,
  requesting_user_id uuid null references auth.users (id) on delete set null,
  assigned_to_user_id uuid null references auth.users (id) on delete set null,
  assigned_role_code text null,
  branch_id uuid null,
  module_code text null,
  entity_type text null,
  entity_id uuid null,
  risk_summary_json jsonb not null default '{}'::jsonb,
  resolution_summary text null,
  requires_legal_review boolean not null default false,
  requires_executive_visibility boolean not null default false,
  requires_trust_visibility boolean not null default false,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz null,
  closed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, case_code)
);

create index if not exists compliance_cases_tenant_status_idx on public.compliance_cases (tenant_id, status, opened_at desc);
create index if not exists compliance_cases_tenant_type_idx on public.compliance_cases (tenant_id, case_type, opened_at desc);
create index if not exists compliance_cases_visibility_idx on public.compliance_cases (tenant_id, requires_executive_visibility, requires_trust_visibility, opened_at desc);

drop trigger if exists compliance_cases_set_updated_at on public.compliance_cases;
create trigger compliance_cases_set_updated_at
before update on public.compliance_cases
for each row execute function public.set_updated_at();

comment on table public.compliance_cases is 'Pack 7: formal cases for compliance/legal/security governance beyond approvals.';

create table if not exists public.compliance_case_links (
  id uuid primary key default gen_random_uuid(),
  compliance_case_id uuid not null references public.compliance_cases (id) on delete cascade,
  link_type text not null,
  linked_id text not null,
  linked_code text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists compliance_case_links_case_idx on public.compliance_case_links (compliance_case_id, created_at desc);

create table if not exists public.compliance_case_events (
  id uuid primary key default gen_random_uuid(),
  compliance_case_id uuid not null references public.compliance_cases (id) on delete cascade,
  event_code text not null,
  title text not null,
  summary text not null,
  actor_user_id uuid null references auth.users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists compliance_case_events_case_idx on public.compliance_case_events (compliance_case_id, created_at asc);

create table if not exists public.compliance_case_assignments (
  id uuid primary key default gen_random_uuid(),
  compliance_case_id uuid not null references public.compliance_cases (id) on delete cascade,
  assigned_to_user_id uuid null references auth.users (id) on delete set null,
  assigned_role_code text null,
  assignment_type text not null check (assignment_type in ('primary','reviewer','investigator','observer')),
  is_active boolean not null default true,
  assigned_at timestamptz not null default now()
);
create index if not exists compliance_case_assignments_case_idx on public.compliance_case_assignments (compliance_case_id, assignment_type, is_active);

-- -----------------------------
-- 2) Evidence bundles + generated packages
-- -----------------------------
create table if not exists public.evidence_bundles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  bundle_code text not null,
  title text not null,
  description text null,
  bundle_type text not null check (bundle_type in ('audit_review','legal_review','case_review','board_pack','trust_pack','compliance_pack','workflow_pack')),
  origin_case_id uuid null references public.compliance_cases (id) on delete set null,
  origin_workflow_id uuid null references public.governance_workflows (id) on delete set null,
  origin_resolution_id uuid null,
  status text not null check (status in ('draft','assembled','finalized','exported','archived')),
  created_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, bundle_code)
);

drop trigger if exists evidence_bundles_set_updated_at on public.evidence_bundles;
create trigger evidence_bundles_set_updated_at
before update on public.evidence_bundles
for each row execute function public.set_updated_at();

create table if not exists public.evidence_bundle_items (
  id uuid primary key default gen_random_uuid(),
  evidence_bundle_id uuid not null references public.evidence_bundles (id) on delete cascade,
  item_type text not null,
  linked_id text not null,
  linked_code text null,
  title text not null,
  summary text not null,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists evidence_bundle_items_bundle_idx on public.evidence_bundle_items (evidence_bundle_id, sort_order, created_at asc);

create table if not exists public.generated_document_packages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  evidence_bundle_id uuid null references public.evidence_bundles (id) on delete set null,
  package_type text not null,
  title text not null,
  status text not null check (status in ('draft','generated','exported','archived','failed')),
  manifest_json jsonb not null default '{}'::jsonb,
  storage_path text null,
  created_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists generated_document_packages_set_updated_at on public.generated_document_packages;
create trigger generated_document_packages_set_updated_at
before update on public.generated_document_packages
for each row execute function public.set_updated_at();

-- -----------------------------
-- 3) Governance anomalies
-- -----------------------------
create table if not exists public.governance_anomalies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  anomaly_code text not null,
  title text not null,
  summary text not null,
  severity text not null check (severity in ('info','warning','high','critical')),
  score numeric not null default 0,
  status text not null check (status in ('open','under_review','dismissed','converted_to_case','resolved')),
  related_user_id uuid null references auth.users (id) on delete set null,
  related_role_code text null,
  branch_id uuid null,
  module_code text null,
  entity_type text null,
  entity_id uuid null,
  source_metric_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists governance_anomalies_set_updated_at on public.governance_anomalies;
create trigger governance_anomalies_set_updated_at
before update on public.governance_anomalies
for each row execute function public.set_updated_at();

create index if not exists governance_anomalies_tenant_status_idx on public.governance_anomalies (tenant_id, status, created_at desc);
create index if not exists governance_anomalies_tenant_code_idx on public.governance_anomalies (tenant_id, anomaly_code, created_at desc);

create table if not exists public.governance_anomaly_actions (
  id uuid primary key default gen_random_uuid(),
  governance_anomaly_id uuid not null references public.governance_anomalies (id) on delete cascade,
  actor_user_id uuid null references auth.users (id) on delete set null,
  action text not null,
  comment text null,
  created_at timestamptz not null default now()
);
create index if not exists governance_anomaly_actions_idx on public.governance_anomaly_actions (governance_anomaly_id, created_at desc);

-- -----------------------------
-- 4) Board / trust resolutions
-- -----------------------------
create table if not exists public.board_resolutions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  resolution_code text not null,
  title text not null,
  summary text not null,
  resolution_type text not null check (resolution_type in ('board_resolution','trust_resolution','executive_resolution','policy_resolution','incident_resolution')),
  status text not null check (status in ('draft','circulating','voting','approved','rejected','recorded','closed')),
  origin_case_id uuid null references public.compliance_cases (id) on delete set null,
  origin_workflow_id uuid null references public.governance_workflows (id) on delete set null,
  origin_anomaly_id uuid null references public.governance_anomalies (id) on delete set null,
  meeting_id text null,
  requires_vote boolean not null default true,
  requires_quorum boolean not null default true,
  quorum_rule_code text null,
  final_outcome text null,
  recorded_at timestamptz null,
  created_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, resolution_code)
);

drop trigger if exists board_resolutions_set_updated_at on public.board_resolutions;
create trigger board_resolutions_set_updated_at
before update on public.board_resolutions
for each row execute function public.set_updated_at();

create table if not exists public.resolution_participants (
  id uuid primary key default gen_random_uuid(),
  board_resolution_id uuid not null references public.board_resolutions (id) on delete cascade,
  participant_user_id uuid not null references auth.users (id) on delete cascade,
  participant_role text not null,
  is_voting_member boolean not null default true,
  attendance_status text not null default 'unknown',
  created_at timestamptz not null default now(),
  unique (board_resolution_id, participant_user_id)
);

create table if not exists public.resolution_votes (
  id uuid primary key default gen_random_uuid(),
  board_resolution_id uuid not null references public.board_resolutions (id) on delete cascade,
  voter_user_id uuid not null references auth.users (id) on delete cascade,
  vote text not null check (vote in ('approve','reject','abstain')),
  comment text null,
  cast_at timestamptz not null default now(),
  unique (board_resolution_id, voter_user_id)
);

create table if not exists public.resolution_events (
  id uuid primary key default gen_random_uuid(),
  board_resolution_id uuid not null references public.board_resolutions (id) on delete cascade,
  event_code text not null,
  title text not null,
  summary text not null,
  actor_user_id uuid null references auth.users (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists resolution_events_idx on public.resolution_events (board_resolution_id, created_at asc);

-- -----------------------------
-- 5) RLS
-- -----------------------------
alter table public.compliance_cases enable row level security;
alter table public.compliance_case_links enable row level security;
alter table public.compliance_case_events enable row level security;
alter table public.compliance_case_assignments enable row level security;
alter table public.evidence_bundles enable row level security;
alter table public.evidence_bundle_items enable row level security;
alter table public.generated_document_packages enable row level security;
alter table public.governance_anomalies enable row level security;
alter table public.governance_anomaly_actions enable row level security;
alter table public.board_resolutions enable row level security;
alter table public.resolution_participants enable row level security;
alter table public.resolution_votes enable row level security;
alter table public.resolution_events enable row level security;

-- Select for tenant members
drop policy if exists compliance_cases_select_member on public.compliance_cases;
create policy compliance_cases_select_member
  on public.compliance_cases for select
  to authenticated
  using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid())));

drop policy if exists compliance_cases_write_admin on public.compliance_cases;
create policy compliance_cases_write_admin
  on public.compliance_cases for update
  to authenticated
  using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin')));

drop policy if exists evidence_bundles_select_member on public.evidence_bundles;
create policy evidence_bundles_select_member
  on public.evidence_bundles for select
  to authenticated
  using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid())));

drop policy if exists evidence_bundles_write_admin on public.evidence_bundles;
create policy evidence_bundles_write_admin
  on public.evidence_bundles for all
  to authenticated
  using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin')))
  with check (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin')));

drop policy if exists governance_anomalies_select_member on public.governance_anomalies;
create policy governance_anomalies_select_member
  on public.governance_anomalies for select
  to authenticated
  using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid())));

drop policy if exists governance_anomalies_write_admin on public.governance_anomalies;
create policy governance_anomalies_write_admin
  on public.governance_anomalies for update
  to authenticated
  using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin')));

drop policy if exists board_resolutions_select_member on public.board_resolutions;
create policy board_resolutions_select_member
  on public.board_resolutions for select
  to authenticated
  using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid())));

drop policy if exists board_resolutions_write_admin on public.board_resolutions;
create policy board_resolutions_write_admin
  on public.board_resolutions for all
  to authenticated
  using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin')))
  with check (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin')));

