-- Pack: Consignment BI foundation (Brain-ready domain model)
-- Models consignment ownership vs custody, movements, settlements, reconciliations, documents, risk flags, and agent scoring.

begin;

-- -----------------------------
-- 1) Agreements (source-of-truth commercial terms)
-- -----------------------------
create table if not exists public.consignment_agreements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  agreement_code text not null,
  status text not null check (status in ('draft','active','paused','expired','terminated')),

  -- principal/vendor side
  principal_vendor_name text not null default '',

  -- custody side (agent + stall/branch)
  agent_id text not null,
  agent_name text not null,
  stall_branch_id text null, -- may map to Inventory branch (local) or a branch uuid later
  stall_label text null,

  -- commission and pricing model
  commission_model text not null check (commission_model in ('percent_of_sale','fixed_per_unit','tiered_percent')),
  commission_percent numeric null,
  commission_fixed_per_unit numeric null,
  commission_tiers_json jsonb not null default '[]'::jsonb,

  -- pricing constraints
  minimum_price_rule text not null default 'none' check (minimum_price_rule in ('none','min_price','min_margin')),
  minimum_price numeric null,
  minimum_margin_percent numeric null,

  -- settlement
  settlement_cycle text not null default 'weekly' check (settlement_cycle in ('daily','weekly','biweekly','monthly','on_demand')),
  settlement_day_of_week int null check (settlement_day_of_week between 1 and 7),
  settlement_day_of_month int null check (settlement_day_of_month between 1 and 31),
  settlement_grace_days int not null default 0,

  -- lifecycle
  effective_from date not null default (now()::date),
  effective_to date null,
  expiry_date date null,

  -- permissions / controls
  allow_discounts boolean not null default false,
  max_discount_percent numeric null,
  allow_price_override boolean not null default false,
  allow_returns boolean not null default true,
  allow_partial_settlement boolean not null default true,

  notes text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, agreement_code)
);

drop trigger if exists consignment_agreements_set_updated_at on public.consignment_agreements;
create trigger consignment_agreements_set_updated_at
before update on public.consignment_agreements
for each row execute function public.set_updated_at();

create index if not exists consignment_agreements_agent_idx on public.consignment_agreements (tenant_id, agent_id, status);
create index if not exists consignment_agreements_branch_idx on public.consignment_agreements (tenant_id, stall_branch_id, status);

-- -----------------------------
-- 2) Consignments (a consignment "case"/batch)
-- -----------------------------
create table if not exists public.consignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  consignment_code text not null,
  agreement_id uuid not null references public.consignment_agreements (id) on delete restrict,

  principal_owner_type text not null default 'tenant' check (principal_owner_type in ('tenant','trust','distribution_group')),
  principal_owner_id text not null default '',

  custody_scope_type text not null default 'branch' check (custody_scope_type in ('agent','branch','warehouse')),
  custody_scope_id text not null default '',

  status text not null check (status in ('draft','issued','in_custody','in_trade','partially_settled','settled','closed','cancelled')),
  issued_at timestamptz null,
  received_at timestamptz null,
  closed_at timestamptz null,

  total_items_count int not null default 0,
  total_cost_value numeric not null default 0,
  total_sellable_qty numeric not null default 0,

  source_document_id uuid null, -- links to consignment_documents
  notes text not null default '',
  metadata jsonb not null default '{}'::jsonb,

  created_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, consignment_code)
);

drop trigger if exists consignments_set_updated_at on public.consignments;
create trigger consignments_set_updated_at
before update on public.consignments
for each row execute function public.set_updated_at();

create index if not exists consignments_agreement_idx on public.consignments (tenant_id, agreement_id, created_at desc);
create index if not exists consignments_custody_idx on public.consignments (tenant_id, custody_scope_type, custody_scope_id, status);

-- -----------------------------
-- 3) Consignment items (line-level: ownership preserved, custody tracked by movements)
-- -----------------------------
create table if not exists public.consignment_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  consignment_id uuid not null references public.consignments (id) on delete cascade,
  product_id text not null,
  sku text null,
  product_name text not null default '',
  unit text null,

  -- ownership is principal; custody is operational
  owner_scope_type text not null default 'tenant' check (owner_scope_type in ('tenant','trust','distribution_group')),
  owner_scope_id text not null default '',

  issued_qty numeric not null default 0,
  received_qty numeric not null default 0,
  sellable_qty numeric not null default 0,
  sold_qty numeric not null default 0,
  returned_qty numeric not null default 0,
  damaged_qty numeric not null default 0,
  missing_qty numeric not null default 0,

  unit_cost numeric not null default 0,
  min_unit_price numeric null,
  commission_model_snapshot text not null default 'percent_of_sale',
  commission_rate_snapshot numeric null,

  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists consignment_items_set_updated_at on public.consignment_items;
create trigger consignment_items_set_updated_at
before update on public.consignment_items
for each row execute function public.set_updated_at();

create index if not exists consignment_items_consignment_idx on public.consignment_items (tenant_id, consignment_id);
create index if not exists consignment_items_product_idx on public.consignment_items (tenant_id, product_id);

-- -----------------------------
-- 4) Movements (immutable event ledger: issue/receive/sell/return/damage/missing/settlement/recon)
-- -----------------------------
create table if not exists public.consignment_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  consignment_id uuid not null references public.consignments (id) on delete cascade,
  consignment_item_id uuid null references public.consignment_items (id) on delete set null,

  movement_type text not null check (movement_type in ('issue','receive','sell','return','damage','missing','adjust','settlement','reconciliation')),
  movement_status text not null default 'posted' check (movement_status in ('draft','posted','reversed','voided')),

  at timestamptz not null default now(),
  actor_user_id uuid null references auth.users (id) on delete set null,
  actor_label text not null default 'system',

  -- ownership stays principal; custody changes
  from_custody_scope_type text null,
  from_custody_scope_id text null,
  to_custody_scope_type text null,
  to_custody_scope_id text null,

  qty_delta numeric not null default 0,
  unit_cost numeric null,
  unit_price numeric null,
  amount_value numeric null,
  currency_code text not null default 'USD',

  reference_code text null,
  source_document_id uuid null, -- consignment_documents
  related_sale_id text null, -- POS sale id if mapped later

  narration text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists consignment_movements_consignment_idx on public.consignment_movements (tenant_id, consignment_id, at desc);
create index if not exists consignment_movements_item_idx on public.consignment_movements (tenant_id, consignment_item_id, at desc);
create index if not exists consignment_movements_type_idx on public.consignment_movements (tenant_id, movement_type, at desc);

-- -----------------------------
-- 5) Settlements (agent->principal settlement periods)
-- -----------------------------
create table if not exists public.consignment_settlements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  agreement_id uuid not null references public.consignment_agreements (id) on delete restrict,
  consignment_id uuid null references public.consignments (id) on delete set null,

  settlement_code text not null,
  period_from date not null,
  period_to date not null,
  status text not null check (status in ('draft','submitted','in_review','approved','rejected','paid','closed')),

  gross_sales_value numeric not null default 0,
  commission_value numeric not null default 0,
  net_due_to_principal numeric not null default 0,
  net_due_to_agent numeric not null default 0,

  currency_code text not null default 'USD',
  notes text not null default '',
  created_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, settlement_code)
);

drop trigger if exists consignment_settlements_set_updated_at on public.consignment_settlements;
create trigger consignment_settlements_set_updated_at
before update on public.consignment_settlements
for each row execute function public.set_updated_at();

create index if not exists consignment_settlements_agreement_idx on public.consignment_settlements (tenant_id, agreement_id, period_to desc);

-- -----------------------------
-- 6) Reconciliations (stock + money reconciliation snapshots)
-- -----------------------------
create table if not exists public.consignment_reconciliations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  agreement_id uuid not null references public.consignment_agreements (id) on delete restrict,
  consignment_id uuid null references public.consignments (id) on delete set null,

  reconciliation_code text not null,
  as_of_at timestamptz not null default now(),
  status text not null check (status in ('draft','submitted','confirmed','disputed','closed')),

  expected_sellable_qty numeric not null default 0,
  physical_count_qty numeric not null default 0,
  variance_qty numeric not null default 0,
  variance_value numeric not null default 0,

  settlement_balance_due numeric not null default 0,
  notes text not null default '',
  created_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, reconciliation_code)
);

drop trigger if exists consignment_reconciliations_set_updated_at on public.consignment_reconciliations;
create trigger consignment_reconciliations_set_updated_at
before update on public.consignment_reconciliations
for each row execute function public.set_updated_at();

create index if not exists consignment_reconciliations_agreement_idx on public.consignment_reconciliations (tenant_id, agreement_id, as_of_at desc);

-- -----------------------------
-- 7) Documents (links to issue invoices, POPs, contracts, evidence bundles, exported packs)
-- -----------------------------
create table if not exists public.consignment_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  agreement_id uuid null references public.consignment_agreements (id) on delete set null,
  consignment_id uuid null references public.consignments (id) on delete set null,
  settlement_id uuid null references public.consignment_settlements (id) on delete set null,
  reconciliation_id uuid null references public.consignment_reconciliations (id) on delete set null,

  document_type text not null check (document_type in ('agreement_contract','issue_invoice','goods_receipt','return_note','damage_report','missing_report','settlement_statement','reconciliation_sheet','evidence_bundle','export_package')),
  document_status text not null default 'active' check (document_status in ('draft','active','voided','archived')),
  reference_code text null,
  title text not null default '',
  storage_kind text not null default 'internal' check (storage_kind in ('internal','external')),
  storage_ref text null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists consignment_documents_set_updated_at on public.consignment_documents;
create trigger consignment_documents_set_updated_at
before update on public.consignment_documents
for each row execute function public.set_updated_at();

create index if not exists consignment_documents_type_idx on public.consignment_documents (tenant_id, document_type, created_at desc);

-- -----------------------------
-- 8) Risk flags (BI + governance signals)
-- -----------------------------
create table if not exists public.consignment_risk_flags (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  agreement_id uuid null references public.consignment_agreements (id) on delete set null,
  consignment_id uuid null references public.consignments (id) on delete set null,
  agent_id text null,
  stall_branch_id text null,

  flag_code text not null,
  severity text not null check (severity in ('low','medium','high','critical')),
  status text not null check (status in ('open','acknowledged','resolved','dismissed')),
  title text not null,
  summary text not null default '',
  evidence_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists consignment_risk_flags_set_updated_at on public.consignment_risk_flags;
create trigger consignment_risk_flags_set_updated_at
before update on public.consignment_risk_flags
for each row execute function public.set_updated_at();

create index if not exists consignment_risk_flags_tenant_idx on public.consignment_risk_flags (tenant_id, status, severity, created_at desc);

-- -----------------------------
-- 9) Agent scores (BI-derived performance snapshots)
-- -----------------------------
create table if not exists public.consignment_agent_scores (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  agent_id text not null,
  agent_name text not null default '',
  stall_branch_id text null,
  score_period text not null, -- e.g. '2026-04' or '2026-W16'
  score_type text not null default 'monthly' check (score_type in ('daily','weekly','monthly','quarterly')),

  score numeric not null default 0,
  reliability_score numeric not null default 0,
  sales_velocity_score numeric not null default 0,
  shrinkage_risk_score numeric not null default 0,
  settlement_discipline_score numeric not null default 0,

  metrics_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, agent_id, score_type, score_period)
);

drop trigger if exists consignment_agent_scores_set_updated_at on public.consignment_agent_scores;
create trigger consignment_agent_scores_set_updated_at
before update on public.consignment_agent_scores
for each row execute function public.set_updated_at();

create index if not exists consignment_agent_scores_idx on public.consignment_agent_scores (tenant_id, score_type, score_period desc);

-- -----------------------------
-- 10) RLS (tenant isolation first; global federation comes via Pack 9 assets separately)
-- -----------------------------
alter table public.consignment_agreements enable row level security;
alter table public.consignments enable row level security;
alter table public.consignment_items enable row level security;
alter table public.consignment_movements enable row level security;
alter table public.consignment_settlements enable row level security;
alter table public.consignment_reconciliations enable row level security;
alter table public.consignment_documents enable row level security;
alter table public.consignment_risk_flags enable row level security;
alter table public.consignment_agent_scores enable row level security;

-- Select: tenant members
do $$
begin
  -- Agreements
  execute 'drop policy if exists consignment_agreements_select_member on public.consignment_agreements';
  execute 'create policy consignment_agreements_select_member on public.consignment_agreements for select to authenticated using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid())))';
  execute 'drop policy if exists consignment_agreements_write_admin on public.consignment_agreements';
  execute 'create policy consignment_agreements_write_admin on public.consignment_agreements for all to authenticated using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in (''owner'',''admin''))) with check (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in (''owner'',''admin'')))';

  -- Consignments
  execute 'drop policy if exists consignments_select_member on public.consignments';
  execute 'create policy consignments_select_member on public.consignments for select to authenticated using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid())))';
  execute 'drop policy if exists consignments_write_admin on public.consignments';
  execute 'create policy consignments_write_admin on public.consignments for all to authenticated using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in (''owner'',''admin''))) with check (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in (''owner'',''admin'')))';

  -- Items
  execute 'drop policy if exists consignment_items_select_member on public.consignment_items';
  execute 'create policy consignment_items_select_member on public.consignment_items for select to authenticated using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid())))';
  execute 'drop policy if exists consignment_items_write_admin on public.consignment_items';
  execute 'create policy consignment_items_write_admin on public.consignment_items for all to authenticated using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in (''owner'',''admin''))) with check (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in (''owner'',''admin'')))';

  -- Movements (append-only by convention; RLS allows admin writes)
  execute 'drop policy if exists consignment_movements_select_member on public.consignment_movements';
  execute 'create policy consignment_movements_select_member on public.consignment_movements for select to authenticated using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid())))';
  execute 'drop policy if exists consignment_movements_write_admin on public.consignment_movements';
  execute 'create policy consignment_movements_write_admin on public.consignment_movements for all to authenticated using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in (''owner'',''admin''))) with check (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in (''owner'',''admin'')))';

  -- Settlements
  execute 'drop policy if exists consignment_settlements_select_member on public.consignment_settlements';
  execute 'create policy consignment_settlements_select_member on public.consignment_settlements for select to authenticated using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid())))';
  execute 'drop policy if exists consignment_settlements_write_admin on public.consignment_settlements';
  execute 'create policy consignment_settlements_write_admin on public.consignment_settlements for all to authenticated using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in (''owner'',''admin''))) with check (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in (''owner'',''admin'')))';

  -- Reconciliations
  execute 'drop policy if exists consignment_reconciliations_select_member on public.consignment_reconciliations';
  execute 'create policy consignment_reconciliations_select_member on public.consignment_reconciliations for select to authenticated using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid())))';
  execute 'drop policy if exists consignment_reconciliations_write_admin on public.consignment_reconciliations';
  execute 'create policy consignment_reconciliations_write_admin on public.consignment_reconciliations for all to authenticated using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in (''owner'',''admin''))) with check (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in (''owner'',''admin'')))';

  -- Documents
  execute 'drop policy if exists consignment_documents_select_member on public.consignment_documents';
  execute 'create policy consignment_documents_select_member on public.consignment_documents for select to authenticated using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid())))';
  execute 'drop policy if exists consignment_documents_write_admin on public.consignment_documents';
  execute 'create policy consignment_documents_write_admin on public.consignment_documents for all to authenticated using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in (''owner'',''admin''))) with check (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in (''owner'',''admin'')))';

  -- Risk flags
  execute 'drop policy if exists consignment_risk_flags_select_member on public.consignment_risk_flags';
  execute 'create policy consignment_risk_flags_select_member on public.consignment_risk_flags for select to authenticated using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid())))';
  execute 'drop policy if exists consignment_risk_flags_write_admin on public.consignment_risk_flags';
  execute 'create policy consignment_risk_flags_write_admin on public.consignment_risk_flags for all to authenticated using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in (''owner'',''admin''))) with check (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in (''owner'',''admin'')))';

  -- Agent scores
  execute 'drop policy if exists consignment_agent_scores_select_member on public.consignment_agent_scores';
  execute 'create policy consignment_agent_scores_select_member on public.consignment_agent_scores for select to authenticated using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid())))';
  execute 'drop policy if exists consignment_agent_scores_write_admin on public.consignment_agent_scores';
  execute 'create policy consignment_agent_scores_write_admin on public.consignment_agent_scores for all to authenticated using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in (''owner'',''admin''))) with check (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in (''owner'',''admin'')))';
end $$;

commit;

