-- Pack 4: Governed execution — execution policies, step-up events, approval links, denial events
-- Integrates with public.permissions(permission_key) and tenant safety via tenant_members

-- -----------------------------
-- 1) permission_execution_policies
-- -----------------------------
create table if not exists public.permission_execution_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid null references public.tenants (id) on delete cascade,
  permission_key text not null references public.permissions (permission_key) on delete cascade,
  requires_reason boolean not null default false,
  requires_step_up boolean not null default false,
  requires_approval boolean not null default false,
  approval_policy_code text null,
  step_up_policy_code text null,
  threshold_type text null check (
    threshold_type is null
    or threshold_type in ('none', 'amount', 'quantity', 'variance', 'percentage', 'margin_delta', 'record_age')
  ),
  threshold_value numeric null,
  applies_when_json jsonb null,
  risk_level_override text null check (
    risk_level_override is null
    or risk_level_override in ('low', 'medium', 'high', 'critical')
  ),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists permission_execution_policies_global_key
  on public.permission_execution_policies (permission_key)
  where tenant_id is null;

create unique index if not exists permission_execution_policies_tenant_key
  on public.permission_execution_policies (tenant_id, permission_key)
  where tenant_id is not null;

create index if not exists permission_execution_policies_tenant_active_idx
  on public.permission_execution_policies (tenant_id, is_active);

drop trigger if exists permission_execution_policies_set_updated_at on public.permission_execution_policies;
create trigger permission_execution_policies_set_updated_at
before update on public.permission_execution_policies
for each row execute function public.set_updated_at();

comment on table public.permission_execution_policies is 'Pack 4: extra execution rules (reason/step-up/approval/thresholds) per permission_key.';

-- -----------------------------
-- 2) step_up_events
-- -----------------------------
create table if not exists public.step_up_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  permission_key text not null,
  action_code text not null default '',
  entity_type text not null default '',
  entity_id uuid null,
  step_up_policy_code text not null,
  status text not null check (status in ('required', 'completed', 'failed', 'expired', 'bypassed')),
  reason text null,
  metadata jsonb not null default '{}'::jsonb,
  verified_by_user_id uuid null references auth.users (id) on delete set null,
  expires_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists step_up_events_tenant_created_idx on public.step_up_events (tenant_id, created_at desc);
create index if not exists step_up_events_user_idx on public.step_up_events (tenant_id, user_id, created_at desc);
create index if not exists step_up_events_permission_idx on public.step_up_events (tenant_id, permission_key);

comment on table public.step_up_events is 'Pack 4: step-up verification hooks (OTP/passcode adapters plug in later).';

-- -----------------------------
-- 3) approval_execution_links
-- -----------------------------
create table if not exists public.approval_execution_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  permission_key text not null,
  action_code text not null default '',
  entity_type text not null default '',
  entity_id uuid null,
  requesting_user_id uuid not null references auth.users (id) on delete cascade,
  approval_request_ref text not null,
  status text not null check (status in ('pending', 'approved', 'rejected', 'cancelled', 'executed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists approval_execution_links_tenant_status_idx
  on public.approval_execution_links (tenant_id, status, created_at desc);
create index if not exists approval_execution_links_user_idx
  on public.approval_execution_links (tenant_id, requesting_user_id);
create unique index if not exists approval_execution_links_dedupe
  on public.approval_execution_links (tenant_id, permission_key, action_code, entity_type, coalesce(entity_id, '00000000-0000-0000-0000-000000000000'::uuid), requesting_user_id)
  where status = 'pending';

drop trigger if exists approval_execution_links_set_updated_at on public.approval_execution_links;
create trigger approval_execution_links_set_updated_at
before update on public.approval_execution_links
for each row execute function public.set_updated_at();

comment on table public.approval_execution_links is 'Pack 4: binds sensitive actions to approval requests (desk/local or future UUID engine).';

-- -----------------------------
-- 4) permission_denial_events
-- -----------------------------
create table if not exists public.permission_denial_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  permission_key text not null,
  reason_code text not null,
  scope_entity_type text null,
  scope_entity_id uuid null,
  desk_code text null,
  entity_type text null,
  entity_id uuid null,
  context_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists permission_denial_events_tenant_created_idx
  on public.permission_denial_events (tenant_id, created_at desc);
create index if not exists permission_denial_events_perm_idx
  on public.permission_denial_events (tenant_id, permission_key, created_at desc);
create index if not exists permission_denial_events_user_idx
  on public.permission_denial_events (tenant_id, user_id, created_at desc);

comment on table public.permission_denial_events is 'Pack 4: meaningful authorization denials for BI/help desk (not every UI click).';

-- -----------------------------
-- 5) RLS
-- -----------------------------
alter table public.permission_execution_policies enable row level security;
alter table public.step_up_events enable row level security;
alter table public.approval_execution_links enable row level security;
alter table public.permission_denial_events enable row level security;

drop policy if exists permission_execution_policies_select_member on public.permission_execution_policies;
create policy permission_execution_policies_select_member
  on public.permission_execution_policies for select
  to authenticated
  using (
    tenant_id is null
    or tenant_id in (
      select tenant_id from public.tenant_members where user_id = (select auth.uid())
    )
  );

drop policy if exists permission_execution_policies_write_admin on public.permission_execution_policies;
create policy permission_execution_policies_write_admin
  on public.permission_execution_policies for all
  to authenticated
  using (
    tenant_id is not null
    and tenant_id in (
      select tenant_id from public.tenant_members
      where user_id = (select auth.uid())
        and role in ('owner', 'admin')
    )
  )
  with check (
    tenant_id is not null
    and tenant_id in (
      select tenant_id from public.tenant_members
      where user_id = (select auth.uid())
        and role in ('owner', 'admin')
    )
  );

drop policy if exists step_up_events_select_member on public.step_up_events;
create policy step_up_events_select_member
  on public.step_up_events for select
  to authenticated
  using (
    tenant_id in (
      select tenant_id from public.tenant_members where user_id = (select auth.uid())
    )
  );

drop policy if exists step_up_events_insert_admin on public.step_up_events;
create policy step_up_events_insert_admin
  on public.step_up_events for insert
  to authenticated
  with check (
    tenant_id in (
      select tenant_id from public.tenant_members
      where user_id = (select auth.uid())
        and role in ('owner', 'admin', 'member')
    )
  );

drop policy if exists step_up_events_update_admin on public.step_up_events;
create policy step_up_events_update_admin
  on public.step_up_events for update
  to authenticated
  using (
    tenant_id in (
      select tenant_id from public.tenant_members
      where user_id = (select auth.uid())
        and role in ('owner', 'admin')
    )
  );

drop policy if exists approval_execution_links_select_member on public.approval_execution_links;
create policy approval_execution_links_select_member
  on public.approval_execution_links for select
  to authenticated
  using (
    tenant_id in (
      select tenant_id from public.tenant_members where user_id = (select auth.uid())
    )
  );

drop policy if exists approval_execution_links_write_authenticated on public.approval_execution_links;
create policy approval_execution_links_write_authenticated
  on public.approval_execution_links for insert
  to authenticated
  with check (
    tenant_id in (
      select tenant_id from public.tenant_members where user_id = (select auth.uid())
    )
  );

drop policy if exists approval_execution_links_update_admin on public.approval_execution_links;
create policy approval_execution_links_update_admin
  on public.approval_execution_links for update
  to authenticated
  using (
    tenant_id in (
      select tenant_id from public.tenant_members
      where user_id = (select auth.uid())
        and role in ('owner', 'admin')
    )
  );

drop policy if exists permission_denial_events_select_member on public.permission_denial_events;
create policy permission_denial_events_select_member
  on public.permission_denial_events for select
  to authenticated
  using (
    tenant_id in (
      select tenant_id from public.tenant_members where user_id = (select auth.uid())
    )
  );

drop policy if exists permission_denial_events_insert_authenticated on public.permission_denial_events;
create policy permission_denial_events_insert_authenticated
  on public.permission_denial_events for insert
  to authenticated
  with check (
    tenant_id in (
      select tenant_id from public.tenant_members where user_id = (select auth.uid())
    )
  );

-- -----------------------------
-- 6) Seed global execution policies (idempotent)
-- -----------------------------
insert into public.permission_execution_policies (
  tenant_id, permission_key, requires_reason, requires_step_up, requires_approval,
  approval_policy_code, step_up_policy_code, threshold_type, threshold_value, applies_when_json, risk_level_override, is_active
)
select v.tenant_id, v.permission_key, v.requires_reason, v.requires_step_up, v.requires_approval,
  v.approval_policy_code, v.step_up_policy_code, v.threshold_type, v.threshold_value, v.applies_when_json, v.risk_level_override, v.is_active
from (
  values
    (null::uuid, 'pos.price.override'::text, true, false, false, null::text, null::text, null::text, null::numeric, null::jsonb, null::text, true),
    (null, 'pos.price.floor_override', true, false, true, 'default_manager', null, 'margin_delta', 0, '{"op":"lt","floor":0}'::jsonb, null, true),
    (null, 'pos.return.full', true, false, false, null, null, null, null, null, null, true),
    (null, 'pos.return.partial', false, false, false, null, null, null, null, null, null, true),
    (null, 'pos.sale.void', true, false, true, 'default_manager', null, null, null, null, null, true),
    (null, 'pos.sale.reopen', false, false, true, 'default_manager', null, null, null, null, null, true),
    (null, 'pos.cash_movement.cash_out', false, false, true, 'default_manager', 'supervisor_passcode', 'amount', 500, null, null, true),
    (null, 'inventory.adjustment.approve', false, false, false, null, null, null, null, null, null, true),
    (null, 'inventory.adjustment.post', false, false, true, 'inventory_threshold', null, 'variance', 100, null, null, true),
    (null, 'inventory.variance.post', true, false, true, 'inventory_threshold', null, 'variance', 50, null, null, true),
    (null, 'inventory.product.delete', true, true, true, 'default_sysadmin', 'manager_confirmation', null, null, null, null, true),
    (null, 'inventory.transfer.approve', false, false, false, null, null, null, null, null, null, true),
    (null, 'finance.expense.approve', false, false, false, null, null, null, null, null, null, true),
    (null, 'finance.expense.reverse', true, false, true, 'default_manager', null, null, null, null, null, true),
    (null, 'finance.journal.reverse', true, false, true, 'default_manager', null, null, null, null, null, true),
    (null, 'finance.period.reopen', true, true, true, 'finance_controller', 're_auth_future', null, null, null, null, true),
    (null, 'finance.reserve_account.manage', false, false, true, 'default_manager', null, null, null, null, null, true),
    (null, 'approval.request.override', true, true, true, 'default_sysadmin', 'dual_control_confirmation', null, null, null, null, true),
    (null, 'system.roles.assign', true, false, true, 'default_sysadmin', null, null, null, null, null, true),
    (null, 'system.roles.manage', true, false, true, 'default_sysadmin', null, null, null, null, null, true),
    (null, 'system.audit.export', true, false, false, null, null, null, null, null, null, true),
    (null, 'security.policy.manage', true, true, true, 'default_sysadmin', 'otp_future', null, null, null, null, true),
    (null, 'security.mfa.manage', true, true, false, null, 'otp_future', null, null, null, null, true),
    (null, 'security.session.force_logout', true, false, false, null, null, null, null, null, null, true),
    (null, 'consignment.settlement.approve', false, false, false, null, null, null, null, null, null, true),
    (null, 'delivery.exception.approve', false, false, false, null, null, null, null, null, null, true),
    (null, 'delivery.dispatch.cancel', false, false, true, 'default_manager', null, null, null, '{"dispatchAssigned":true}'::jsonb, null, true)
) as v(
  tenant_id, permission_key, requires_reason, requires_step_up, requires_approval,
  approval_policy_code, step_up_policy_code, threshold_type, threshold_value, applies_when_json, risk_level_override, is_active
)
where not exists (
  select 1
  from public.permission_execution_policies p
  where p.tenant_id is null
    and p.permission_key = v.permission_key
);
