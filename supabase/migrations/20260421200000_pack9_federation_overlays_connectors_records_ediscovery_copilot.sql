-- Pack 9: Enterprise multi-tenant governance federation, policy overlays, regulator connectors,
-- records management + e-discovery, and governance copilot boundaries.

-- -----------------------------
-- 1) Federation scopes
-- -----------------------------
create table if not exists public.federation_scopes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid null references public.tenants (id) on delete cascade,
  scope_type text not null check (scope_type in ('global','trust','distribution_group','region','country','tenant','branch')),
  scope_code text not null,
  title text not null,
  parent_scope_id uuid null references public.federation_scopes (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), scope_type, scope_code)
);

drop trigger if exists federation_scopes_set_updated_at on public.federation_scopes;
create trigger federation_scopes_set_updated_at
before update on public.federation_scopes
for each row execute function public.set_updated_at();

-- -----------------------------
-- 2) Federated governance assets: scope + lineage
-- -----------------------------
create table if not exists public.governance_asset_scopes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid null references public.tenants (id) on delete cascade,
  asset_type text not null check (asset_type in ('policy','policy_version','review_cycle','archive_policy','document_template','anomaly_rule','connector','guidance_template','records_rule','ediscovery_rule')),
  asset_id text not null,
  owner_scope_type text not null check (owner_scope_type in ('global','trust','distribution_group','region','country','tenant','branch')),
  owner_scope_id uuid null references public.federation_scopes (id) on delete set null,
  applies_to_scope_type text not null check (applies_to_scope_type in ('global','trust','distribution_group','region','country','tenant','branch')),
  applies_to_scope_id uuid null references public.federation_scopes (id) on delete set null,
  inheritance_mode text not null check (inheritance_mode in ('direct','inherited','overlay','adopted')),
  can_be_overridden boolean not null default true,
  is_protected boolean not null default false,
  priority_rank integer not null default 100,
  effective_from timestamptz not null default now(),
  effective_to timestamptz null,
  created_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists governance_asset_scopes_set_updated_at on public.governance_asset_scopes;
create trigger governance_asset_scopes_set_updated_at
before update on public.governance_asset_scopes
for each row execute function public.set_updated_at();

create index if not exists governance_asset_scopes_lookup_idx
  on public.governance_asset_scopes (asset_type, asset_id, priority_rank, effective_from desc);

create table if not exists public.governance_asset_lineage (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid null references public.tenants (id) on delete cascade,
  asset_type text not null,
  parent_asset_id text not null,
  child_asset_id text not null,
  lineage_type text not null check (lineage_type in ('derived_from','overlay_of','adopted_from','supersedes')),
  created_at timestamptz not null default now()
);

create index if not exists governance_asset_lineage_parent_idx on public.governance_asset_lineage (asset_type, parent_asset_id, created_at desc);
create index if not exists governance_asset_lineage_child_idx on public.governance_asset_lineage (asset_type, child_asset_id, created_at desc);

-- -----------------------------
-- 3) Policy overlays (regional/country/tenant/branch)
-- -----------------------------
create table if not exists public.policy_overlays (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid null references public.tenants (id) on delete cascade,
  base_policy_id uuid not null references public.governance_policies (id) on delete cascade,
  base_policy_version_id uuid null references public.governance_policy_versions (id) on delete set null,
  overlay_scope_type text not null check (overlay_scope_type in ('region','country','tenant','branch')),
  overlay_scope_id uuid not null references public.federation_scopes (id) on delete cascade,
  overlay_code text not null,
  title text not null,
  status text not null check (status in ('draft','approved','published','superseded','archived')),
  overlay_definition_json jsonb not null default '{}'::jsonb,
  change_summary text not null default '',
  priority_rank integer not null default 100,
  effective_from timestamptz not null default now(),
  effective_to timestamptz null,
  created_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), overlay_code)
);

drop trigger if exists policy_overlays_set_updated_at on public.policy_overlays;
create trigger policy_overlays_set_updated_at
before update on public.policy_overlays
for each row execute function public.set_updated_at();

create index if not exists policy_overlays_base_idx on public.policy_overlays (base_policy_id, status, effective_from desc);
create index if not exists policy_overlays_scope_idx on public.policy_overlays (overlay_scope_type, overlay_scope_id, status, priority_rank);

-- -----------------------------
-- 4) Regulator connectors + run logs
-- -----------------------------
create table if not exists public.regulator_connectors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid null references public.tenants (id) on delete cascade,
  connector_code text not null,
  title text not null,
  region_code text null,
  country_code text null,
  connector_type text not null,
  status text not null check (status in ('draft','active','disabled')),
  config_json jsonb not null default '{}'::jsonb,
  supported_events_json jsonb not null default '[]'::jsonb,
  retry_policy_json jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), connector_code)
);

drop trigger if exists regulator_connectors_set_updated_at on public.regulator_connectors;
create trigger regulator_connectors_set_updated_at
before update on public.regulator_connectors
for each row execute function public.set_updated_at();

create table if not exists public.regulator_connector_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  connector_code text not null,
  event_type text not null,
  direction text not null check (direction in ('outbound','inbound')),
  status text not null check (status in ('pending','sent','acknowledged','failed','received','processed','dry_run')),
  reference_code text null,
  payload_json jsonb not null default '{}'::jsonb,
  response_json jsonb null,
  error_message text null,
  is_dry_run boolean not null default false,
  created_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists regulator_connector_runs_set_updated_at on public.regulator_connector_runs;
create trigger regulator_connector_runs_set_updated_at
before update on public.regulator_connector_runs
for each row execute function public.set_updated_at();

create index if not exists regulator_connector_runs_tenant_idx on public.regulator_connector_runs (tenant_id, connector_code, created_at desc);

-- -----------------------------
-- 5) Records management: registry, schedules, holds
-- -----------------------------
create table if not exists public.retention_schedules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid null references public.tenants (id) on delete cascade,
  schedule_code text not null,
  title text not null,
  applies_to_record_classification text not null,
  retention_period_days integer not null,
  archive_after_days integer not null default 30,
  destruction_policy text not null check (destruction_policy in ('manual','auto_with_review','never_auto')),
  requires_hold_check boolean not null default true,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), schedule_code)
);

drop trigger if exists retention_schedules_set_updated_at on public.retention_schedules;
create trigger retention_schedules_set_updated_at
before update on public.retention_schedules
for each row execute function public.set_updated_at();

create table if not exists public.records_registry (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid null references public.tenants (id) on delete cascade,
  record_type text not null,
  record_id text not null,
  record_classification text not null,
  record_series_code text null,
  retention_schedule_code text null,
  archive_status text not null default 'active' check (archive_status in ('active','archived','on_hold','destroyed')),
  is_on_legal_hold boolean not null default false,
  is_on_trust_hold boolean not null default false,
  is_on_regulatory_hold boolean not null default false,
  destruction_eligible_at timestamptz null,
  indexed_text text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), record_type, record_id)
);

drop trigger if exists records_registry_set_updated_at on public.records_registry;
create trigger records_registry_set_updated_at
before update on public.records_registry
for each row execute function public.set_updated_at();

create index if not exists records_registry_tenant_class_idx on public.records_registry (tenant_id, record_classification, updated_at desc);

create table if not exists public.record_holds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  record_type text not null,
  record_id text not null,
  hold_type text not null check (hold_type in ('legal','trust','regulatory','investigation')),
  reason text not null,
  status text not null check (status in ('active','released')),
  placed_by uuid null references auth.users (id) on delete set null,
  placed_at timestamptz not null default now(),
  released_by uuid null references auth.users (id) on delete set null,
  released_at timestamptz null
);

create index if not exists record_holds_tenant_idx on public.record_holds (tenant_id, status, placed_at desc);

-- -----------------------------
-- 6) E-discovery
-- -----------------------------
create table if not exists public.ediscovery_matters (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  matter_code text not null,
  title text not null,
  summary text null,
  status text not null check (status in ('open','closed','suspended')),
  opened_by uuid null references auth.users (id) on delete set null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz null,
  unique (tenant_id, matter_code)
);

create table if not exists public.ediscovery_collections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  ediscovery_matter_id uuid not null references public.ediscovery_matters (id) on delete cascade,
  collection_code text not null,
  query_json jsonb not null default '{}'::jsonb,
  status text not null check (status in ('draft','running','complete','failed','archived')),
  item_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists ediscovery_collections_set_updated_at on public.ediscovery_collections;
create trigger ediscovery_collections_set_updated_at
before update on public.ediscovery_collections
for each row execute function public.set_updated_at();

create table if not exists public.ediscovery_review_sets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  ediscovery_matter_id uuid not null references public.ediscovery_matters (id) on delete cascade,
  title text not null,
  summary text null,
  status text not null check (status in ('open','exported','archived')),
  created_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.ediscovery_review_set_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  ediscovery_review_set_id uuid not null references public.ediscovery_review_sets (id) on delete cascade,
  record_type text not null,
  record_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ediscovery_review_set_items_idx on public.ediscovery_review_set_items (tenant_id, ediscovery_review_set_id);

create table if not exists public.ediscovery_search_audit (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  actor_user_id uuid null references auth.users (id) on delete set null,
  matter_id uuid null references public.ediscovery_matters (id) on delete set null,
  query_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ediscovery_search_audit_tenant_idx on public.ediscovery_search_audit (tenant_id, created_at desc);

-- -----------------------------
-- 7) Copilot boundary audit (no execute mode)
-- -----------------------------
create table if not exists public.governance_copilot_queries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  actor_user_id uuid null references auth.users (id) on delete set null,
  mode text not null check (mode in ('explain','summarize','find','compare','suggest')),
  query_text text not null,
  context_json jsonb not null default '{}'::jsonb,
  response_summary text null,
  created_at timestamptz not null default now()
);

create index if not exists governance_copilot_queries_tenant_idx on public.governance_copilot_queries (tenant_id, created_at desc);

-- -----------------------------
-- 8) RLS
-- -----------------------------
alter table public.federation_scopes enable row level security;
alter table public.governance_asset_scopes enable row level security;
alter table public.governance_asset_lineage enable row level security;
alter table public.policy_overlays enable row level security;
alter table public.regulator_connectors enable row level security;
alter table public.regulator_connector_runs enable row level security;
alter table public.retention_schedules enable row level security;
alter table public.records_registry enable row level security;
alter table public.record_holds enable row level security;
alter table public.ediscovery_matters enable row level security;
alter table public.ediscovery_collections enable row level security;
alter table public.ediscovery_review_sets enable row level security;
alter table public.ediscovery_review_set_items enable row level security;
alter table public.ediscovery_search_audit enable row level security;
alter table public.governance_copilot_queries enable row level security;

-- Federation scopes: tenant members can see tenant scopes; public scopes are readable to all authenticated
drop policy if exists federation_scopes_select_member on public.federation_scopes;
create policy federation_scopes_select_member
  on public.federation_scopes for select
  to authenticated
  using (
    is_public = true
    or tenant_id is null
    or tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()))
  );

drop policy if exists federation_scopes_write_admin on public.federation_scopes;
create policy federation_scopes_write_admin
  on public.federation_scopes for all
  to authenticated
  using (
    tenant_id is not null
    and tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin'))
  )
  with check (
    tenant_id is not null
    and tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin'))
  );

-- Asset scopes/lineage: tenant members; allow public global assets where tenant_id is null
drop policy if exists governance_asset_scopes_select_member on public.governance_asset_scopes;
create policy governance_asset_scopes_select_member
  on public.governance_asset_scopes for select
  to authenticated
  using (
    tenant_id is null
    or tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()))
  );

drop policy if exists governance_asset_scopes_write_admin on public.governance_asset_scopes;
create policy governance_asset_scopes_write_admin
  on public.governance_asset_scopes for all
  to authenticated
  using (
    tenant_id is not null
    and tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin'))
  )
  with check (
    tenant_id is not null
    and tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin'))
  );

drop policy if exists governance_asset_lineage_select_member on public.governance_asset_lineage;
create policy governance_asset_lineage_select_member
  on public.governance_asset_lineage for select
  to authenticated
  using (
    tenant_id is null
    or tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()))
  );

drop policy if exists governance_asset_lineage_write_admin on public.governance_asset_lineage;
create policy governance_asset_lineage_write_admin
  on public.governance_asset_lineage for all
  to authenticated
  using (
    tenant_id is not null
    and tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin'))
  )
  with check (
    tenant_id is not null
    and tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin'))
  );

-- Policy overlays: tenant members + global overlays (tenant_id null)
drop policy if exists policy_overlays_select_member on public.policy_overlays;
create policy policy_overlays_select_member
  on public.policy_overlays for select
  to authenticated
  using (
    tenant_id is null
    or tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()))
  );

drop policy if exists policy_overlays_write_admin on public.policy_overlays;
create policy policy_overlays_write_admin
  on public.policy_overlays for all
  to authenticated
  using (
    tenant_id is not null
    and tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin'))
  )
  with check (
    tenant_id is not null
    and tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin'))
  );

-- Connectors: tenant members can see tenant connectors; global connectors only if is_public
drop policy if exists regulator_connectors_select_member on public.regulator_connectors;
create policy regulator_connectors_select_member
  on public.regulator_connectors for select
  to authenticated
  using (
    (tenant_id is null and is_public = true)
    or tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()))
  );

drop policy if exists regulator_connectors_write_admin on public.regulator_connectors;
create policy regulator_connectors_write_admin
  on public.regulator_connectors for all
  to authenticated
  using (
    tenant_id is not null
    and tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin'))
  )
  with check (
    tenant_id is not null
    and tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin'))
  );

drop policy if exists regulator_connector_runs_select_member on public.regulator_connector_runs;
create policy regulator_connector_runs_select_member
  on public.regulator_connector_runs for select
  to authenticated
  using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid())));

drop policy if exists regulator_connector_runs_write_admin on public.regulator_connector_runs;
create policy regulator_connector_runs_write_admin
  on public.regulator_connector_runs for all
  to authenticated
  using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin')))
  with check (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin')));

-- Records: tenant members; global schedules readable when public
drop policy if exists retention_schedules_select_member on public.retention_schedules;
create policy retention_schedules_select_member
  on public.retention_schedules for select
  to authenticated
  using (
    (tenant_id is null and is_public = true)
    or tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()))
  );

drop policy if exists retention_schedules_write_admin on public.retention_schedules;
create policy retention_schedules_write_admin
  on public.retention_schedules for all
  to authenticated
  using (
    tenant_id is not null
    and tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin'))
  )
  with check (
    tenant_id is not null
    and tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin'))
  );

drop policy if exists records_registry_select_member on public.records_registry;
create policy records_registry_select_member
  on public.records_registry for select
  to authenticated
  using (
    tenant_id is null
    or tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()))
  );

drop policy if exists records_registry_write_admin on public.records_registry;
create policy records_registry_write_admin
  on public.records_registry for all
  to authenticated
  using (
    tenant_id is not null
    and tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin'))
  )
  with check (
    tenant_id is not null
    and tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin'))
  );

drop policy if exists record_holds_select_member on public.record_holds;
create policy record_holds_select_member
  on public.record_holds for select
  to authenticated
  using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid())));

drop policy if exists record_holds_write_admin on public.record_holds;
create policy record_holds_write_admin
  on public.record_holds for all
  to authenticated
  using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin')))
  with check (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin')));

-- E-discovery: tenant members only (tight)
drop policy if exists ediscovery_matters_select_member on public.ediscovery_matters;
create policy ediscovery_matters_select_member
  on public.ediscovery_matters for select
  to authenticated
  using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid())));

drop policy if exists ediscovery_matters_write_admin on public.ediscovery_matters;
create policy ediscovery_matters_write_admin
  on public.ediscovery_matters for all
  to authenticated
  using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin')))
  with check (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin')));

drop policy if exists ediscovery_collections_select_member on public.ediscovery_collections;
create policy ediscovery_collections_select_member
  on public.ediscovery_collections for select
  to authenticated
  using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid())));

drop policy if exists ediscovery_collections_write_admin on public.ediscovery_collections;
create policy ediscovery_collections_write_admin
  on public.ediscovery_collections for all
  to authenticated
  using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin')))
  with check (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin')));

drop policy if exists ediscovery_review_sets_select_member on public.ediscovery_review_sets;
create policy ediscovery_review_sets_select_member
  on public.ediscovery_review_sets for select
  to authenticated
  using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid())));

drop policy if exists ediscovery_review_sets_write_admin on public.ediscovery_review_sets;
create policy ediscovery_review_sets_write_admin
  on public.ediscovery_review_sets for all
  to authenticated
  using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin')))
  with check (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin')));

drop policy if exists ediscovery_review_set_items_select_member on public.ediscovery_review_set_items;
create policy ediscovery_review_set_items_select_member
  on public.ediscovery_review_set_items for select
  to authenticated
  using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid())));

drop policy if exists ediscovery_review_set_items_write_admin on public.ediscovery_review_set_items;
create policy ediscovery_review_set_items_write_admin
  on public.ediscovery_review_set_items for all
  to authenticated
  using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin')))
  with check (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin')));

drop policy if exists ediscovery_search_audit_select_member on public.ediscovery_search_audit;
create policy ediscovery_search_audit_select_member
  on public.ediscovery_search_audit for select
  to authenticated
  using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid())));

drop policy if exists governance_copilot_queries_select_member on public.governance_copilot_queries;
create policy governance_copilot_queries_select_member
  on public.governance_copilot_queries for select
  to authenticated
  using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid())));

drop policy if exists governance_copilot_queries_write_member on public.governance_copilot_queries;
create policy governance_copilot_queries_write_member
  on public.governance_copilot_queries for insert
  to authenticated
  with check (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid())));

