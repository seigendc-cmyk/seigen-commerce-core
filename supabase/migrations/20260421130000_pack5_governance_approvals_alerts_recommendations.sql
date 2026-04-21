-- Pack 5: Approval engine refinement + execution jobs + governance alerts + recommendations + supervisor secrets
-- Tenant safety: all tenant-scoped tables use RLS via tenant_members.

-- -----------------------------
-- 0) Helpers
-- -----------------------------
-- public.set_updated_at() already exists in Pack 1

-- -----------------------------
-- 1) Approval engine (persistent)
-- -----------------------------
create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  approval_policy_code text not null,
  permission_key text not null,
  action_code text not null,
  module_code text not null,
  entity_type text not null,
  entity_id uuid null,
  requesting_user_id uuid not null references auth.users (id) on delete cascade,
  requesting_role_code text null,
  branch_id uuid null,
  warehouse_id uuid null,
  terminal_id uuid null,
  reason text null,
  payload_json jsonb not null default '{}'::jsonb,
  status text not null check (status in ('draft','pending','partially_approved','approved','rejected','cancelled','expired','escalated','executed','execution_failed')),
  risk_level text not null check (risk_level in ('low','medium','high','critical')),
  due_at timestamptz null,
  expires_at timestamptz null,
  approved_at timestamptz null,
  rejected_at timestamptz null,
  executed_at timestamptz null,
  cancelled_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists approval_requests_tenant_status_idx on public.approval_requests (tenant_id, status, created_at desc);
create index if not exists approval_requests_tenant_policy_idx on public.approval_requests (tenant_id, approval_policy_code);
create index if not exists approval_requests_tenant_permission_idx on public.approval_requests (tenant_id, permission_key, created_at desc);
create index if not exists approval_requests_requester_idx on public.approval_requests (tenant_id, requesting_user_id, created_at desc);
create index if not exists approval_requests_due_idx on public.approval_requests (tenant_id, due_at) where due_at is not null;

drop trigger if exists approval_requests_set_updated_at on public.approval_requests;
create trigger approval_requests_set_updated_at
before update on public.approval_requests
for each row execute function public.set_updated_at();

comment on table public.approval_requests is 'Pack 5: governed approval requests linked to permissions/actions. Drives execution finalization jobs.';

create table if not exists public.approval_request_stages (
  id uuid primary key default gen_random_uuid(),
  approval_request_id uuid not null references public.approval_requests (id) on delete cascade,
  stage_order integer not null,
  stage_code text not null,
  approver_type text not null check (approver_type in ('role','user','desk','branch_manager','finance_controller','sysadmin')),
  approver_role_code text null,
  approver_user_id uuid null references auth.users (id) on delete set null,
  approver_scope_json jsonb null,
  required_approvals_count integer not null default 1,
  status text not null check (status in ('pending','completed','rejected','skipped','escalated','expired')),
  due_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now()
);

create unique index if not exists approval_request_stages_unique_order on public.approval_request_stages (approval_request_id, stage_order);
create index if not exists approval_request_stages_status_idx on public.approval_request_stages (status, due_at);

comment on table public.approval_request_stages is 'Pack 5: stage sequencing, approver assignments, SLA deadlines.';

create table if not exists public.approval_stage_actions (
  id uuid primary key default gen_random_uuid(),
  approval_request_id uuid not null references public.approval_requests (id) on delete cascade,
  approval_request_stage_id uuid not null references public.approval_request_stages (id) on delete cascade,
  actor_user_id uuid null references auth.users (id) on delete set null,
  action text not null check (action in ('approve','reject','delegate','request_info','escalate','comment')),
  comment text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists approval_stage_actions_req_idx on public.approval_stage_actions (approval_request_id, created_at desc);
create index if not exists approval_stage_actions_stage_idx on public.approval_stage_actions (approval_request_stage_id, created_at desc);

comment on table public.approval_stage_actions is 'Pack 5: immutable action history for approvals (auditable).';

create table if not exists public.approval_delegations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  from_user_id uuid not null references auth.users (id) on delete cascade,
  to_user_id uuid not null references auth.users (id) on delete cascade,
  scope_json jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists approval_delegations_tenant_active_idx on public.approval_delegations (tenant_id, is_active, starts_at desc);

comment on table public.approval_delegations is 'Pack 5: auditable delegation rules for approvals.';

create table if not exists public.approval_escalations (
  id uuid primary key default gen_random_uuid(),
  approval_request_id uuid not null references public.approval_requests (id) on delete cascade,
  from_stage_id uuid null references public.approval_request_stages (id) on delete set null,
  escalation_rule_code text not null,
  escalated_to_role_code text null,
  escalated_to_user_id uuid null references auth.users (id) on delete set null,
  reason text null,
  created_at timestamptz not null default now()
);

create index if not exists approval_escalations_req_idx on public.approval_escalations (approval_request_id, created_at desc);

comment on table public.approval_escalations is 'Pack 5: escalation audit trail for overdue/high-risk approvals.';

-- -----------------------------
-- 2) Execution jobs (deferred action finalization)
-- -----------------------------
create table if not exists public.approval_execution_jobs (
  id uuid primary key default gen_random_uuid(),
  approval_request_id uuid not null references public.approval_requests (id) on delete cascade,
  execution_key text not null,
  status text not null check (status in ('pending','ready','running','completed','failed','cancelled')),
  handler_code text not null,
  payload_json jsonb not null default '{}'::jsonb,
  result_json jsonb null,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (approval_request_id, execution_key)
);

create index if not exists approval_execution_jobs_status_idx on public.approval_execution_jobs (status, updated_at desc);

drop trigger if exists approval_execution_jobs_set_updated_at on public.approval_execution_jobs;
create trigger approval_execution_jobs_set_updated_at
before update on public.approval_execution_jobs
for each row execute function public.set_updated_at();

comment on table public.approval_execution_jobs is 'Pack 5: idempotent deferred execution jobs. Only execute once.';

-- -----------------------------
-- 3) Supervisor passcode secrets (hashed)
-- -----------------------------
create table if not exists public.supervisor_passcode_secrets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  hash_alg text not null default 'sha256',
  salt text not null,
  passcode_hash text not null,
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

drop trigger if exists supervisor_passcode_secrets_set_updated_at on public.supervisor_passcode_secrets;
create trigger supervisor_passcode_secrets_set_updated_at
before update on public.supervisor_passcode_secrets
for each row execute function public.set_updated_at();

comment on table public.supervisor_passcode_secrets is 'Pack 5: hashed supervisor passcodes for step-up verification (no plaintext).';

-- -----------------------------
-- 4) Governance alerts
-- -----------------------------
create table if not exists public.governance_alerts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  alert_code text not null,
  severity text not null check (severity in ('info','warning','high','critical')),
  title text not null,
  summary text not null,
  entity_type text null,
  entity_id uuid null,
  related_user_id uuid null references auth.users (id) on delete set null,
  related_role_code text null,
  branch_id uuid null,
  status text not null check (status in ('open','acknowledged','resolved','dismissed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists governance_alerts_tenant_status_idx on public.governance_alerts (tenant_id, status, created_at desc);
create index if not exists governance_alerts_tenant_code_idx on public.governance_alerts (tenant_id, alert_code, created_at desc);

drop trigger if exists governance_alerts_set_updated_at on public.governance_alerts;
create trigger governance_alerts_set_updated_at
before update on public.governance_alerts
for each row execute function public.set_updated_at();

comment on table public.governance_alerts is 'Pack 5: actionable governance alerts (overdue approvals, step-up failures, repeated denials, execution failures).';

create table if not exists public.governance_alert_actions (
  id uuid primary key default gen_random_uuid(),
  governance_alert_id uuid not null references public.governance_alerts (id) on delete cascade,
  actor_user_id uuid null references auth.users (id) on delete set null,
  action text not null check (action in ('acknowledge','resolve','dismiss','comment')),
  comment text null,
  created_at timestamptz not null default now()
);

create index if not exists governance_alert_actions_alert_idx on public.governance_alert_actions (governance_alert_id, created_at desc);

-- -----------------------------
-- 5) Governance recommendations
-- -----------------------------
create table if not exists public.governance_recommendations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  recommendation_code text not null,
  category text not null,
  severity text not null check (severity in ('info','warning','high','critical')),
  title text not null,
  summary text not null,
  rationale text not null,
  suggested_action text not null,
  status text not null check (status in ('open','accepted','dismissed','implemented')),
  source_metric_json jsonb not null default '{}'::jsonb,
  entity_type text null,
  entity_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists governance_recommendations_tenant_status_idx on public.governance_recommendations (tenant_id, status, created_at desc);
create index if not exists governance_recommendations_tenant_code_idx on public.governance_recommendations (tenant_id, recommendation_code, created_at desc);

drop trigger if exists governance_recommendations_set_updated_at on public.governance_recommendations;
create trigger governance_recommendations_set_updated_at
before update on public.governance_recommendations
for each row execute function public.set_updated_at();

create table if not exists public.governance_recommendation_actions (
  id uuid primary key default gen_random_uuid(),
  governance_recommendation_id uuid not null references public.governance_recommendations (id) on delete cascade,
  actor_user_id uuid null references auth.users (id) on delete set null,
  action text not null,
  comment text null,
  created_at timestamptz not null default now()
);

create index if not exists governance_recommendation_actions_idx on public.governance_recommendation_actions (governance_recommendation_id, created_at desc);

-- -----------------------------
-- 6) RLS policies
-- -----------------------------
alter table public.approval_requests enable row level security;
alter table public.approval_request_stages enable row level security;
alter table public.approval_stage_actions enable row level security;
alter table public.approval_delegations enable row level security;
alter table public.approval_escalations enable row level security;
alter table public.approval_execution_jobs enable row level security;
alter table public.supervisor_passcode_secrets enable row level security;
alter table public.governance_alerts enable row level security;
alter table public.governance_alert_actions enable row level security;
alter table public.governance_recommendations enable row level security;
alter table public.governance_recommendation_actions enable row level security;

-- approval_requests: members can select; members can insert their own requests; admins can update/manage
drop policy if exists approval_requests_select_member on public.approval_requests;
create policy approval_requests_select_member
  on public.approval_requests for select
  to authenticated
  using (
    tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()))
  );

drop policy if exists approval_requests_insert_member on public.approval_requests;
create policy approval_requests_insert_member
  on public.approval_requests for insert
  to authenticated
  with check (
    tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()))
    and requesting_user_id = (select auth.uid())
  );

drop policy if exists approval_requests_update_admin on public.approval_requests;
create policy approval_requests_update_admin
  on public.approval_requests for update
  to authenticated
  using (
    tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin'))
  );

-- stages/actions/jobs/escalations: readable to members; inserts allowed to members; updates restricted to admins
drop policy if exists approval_request_stages_select_member on public.approval_request_stages;
create policy approval_request_stages_select_member
  on public.approval_request_stages for select
  to authenticated
  using (
    exists (
      select 1 from public.approval_requests r
      where r.id = approval_request_stages.approval_request_id
        and r.tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()))
    )
  );

drop policy if exists approval_stage_actions_select_member on public.approval_stage_actions;
create policy approval_stage_actions_select_member
  on public.approval_stage_actions for select
  to authenticated
  using (
    exists (
      select 1 from public.approval_requests r
      where r.id = approval_stage_actions.approval_request_id
        and r.tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()))
    )
  );

drop policy if exists approval_stage_actions_insert_member on public.approval_stage_actions;
create policy approval_stage_actions_insert_member
  on public.approval_stage_actions for insert
  to authenticated
  with check (
    exists (
      select 1 from public.approval_requests r
      where r.id = approval_stage_actions.approval_request_id
        and r.tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()))
    )
  );

drop policy if exists approval_execution_jobs_select_member on public.approval_execution_jobs;
create policy approval_execution_jobs_select_member
  on public.approval_execution_jobs for select
  to authenticated
  using (
    exists (
      select 1 from public.approval_requests r
      where r.id = approval_execution_jobs.approval_request_id
        and r.tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()))
    )
  );

drop policy if exists approval_execution_jobs_update_admin on public.approval_execution_jobs;
create policy approval_execution_jobs_update_admin
  on public.approval_execution_jobs for update
  to authenticated
  using (
    exists (
      select 1 from public.approval_requests r
      where r.id = approval_execution_jobs.approval_request_id
        and r.tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin'))
    )
  );

drop policy if exists approval_delegations_select_member on public.approval_delegations;
create policy approval_delegations_select_member
  on public.approval_delegations for select
  to authenticated
  using (
    tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()))
  );

drop policy if exists approval_delegations_write_admin on public.approval_delegations;
create policy approval_delegations_write_admin
  on public.approval_delegations for all
  to authenticated
  using (
    tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin'))
  )
  with check (
    tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin'))
  );

drop policy if exists supervisor_passcode_secrets_select_admin on public.supervisor_passcode_secrets;
create policy supervisor_passcode_secrets_select_admin
  on public.supervisor_passcode_secrets for select
  to authenticated
  using (
    tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin'))
  );

drop policy if exists supervisor_passcode_secrets_write_admin on public.supervisor_passcode_secrets;
create policy supervisor_passcode_secrets_write_admin
  on public.supervisor_passcode_secrets for all
  to authenticated
  using (
    tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin'))
  )
  with check (
    tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin'))
  );

-- governance alerts/recommendations: members can select; admins can update
drop policy if exists governance_alerts_select_member on public.governance_alerts;
create policy governance_alerts_select_member
  on public.governance_alerts for select
  to authenticated
  using (
    tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()))
  );

drop policy if exists governance_alerts_write_admin on public.governance_alerts;
create policy governance_alerts_write_admin
  on public.governance_alerts for update
  to authenticated
  using (
    tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin'))
  );

drop policy if exists governance_alert_actions_select_member on public.governance_alert_actions;
create policy governance_alert_actions_select_member
  on public.governance_alert_actions for select
  to authenticated
  using (
    exists (
      select 1 from public.governance_alerts a
      where a.id = governance_alert_actions.governance_alert_id
        and a.tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()))
    )
  );

drop policy if exists governance_alert_actions_insert_member on public.governance_alert_actions;
create policy governance_alert_actions_insert_member
  on public.governance_alert_actions for insert
  to authenticated
  with check (
    exists (
      select 1 from public.governance_alerts a
      where a.id = governance_alert_actions.governance_alert_id
        and a.tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()))
    )
  );

drop policy if exists governance_recommendations_select_member on public.governance_recommendations;
create policy governance_recommendations_select_member
  on public.governance_recommendations for select
  to authenticated
  using (
    tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()))
  );

drop policy if exists governance_recommendations_write_admin on public.governance_recommendations;
create policy governance_recommendations_write_admin
  on public.governance_recommendations for update
  to authenticated
  using (
    tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in ('owner','admin'))
  );

