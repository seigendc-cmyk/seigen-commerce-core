-- Pack 1: RBAC schema + seeds (production-grade foundation)
-- Notes:
-- - Uses tenant safety via public.tenant_members
-- - Keeps system permissions/roles seeded with tenant_id = null
-- - Keeps writes limited to tenant owners/admins (system rows are service-role only)
-- - Seeds are idempotent via upserts

-- -----------------------------
-- 0) Helpers: updated_at trigger
-- -----------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------
-- 1) Enums as check constraints
-- -----------------------------
-- risk_level: low | medium | high | critical
-- scope_type: tenant | branch | warehouse | terminal | desk
-- override_type: grant | deny
-- access_level: allowed | denied | read_only

-- -----------------------------
-- 2) Tables
-- -----------------------------

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  permission_key text not null unique,
  label text not null,
  description text null,
  module_code text not null,
  category_code text not null,
  resource_code text not null,
  action_code text not null,
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  scope_type text not null default 'tenant' check (scope_type in ('tenant', 'branch', 'warehouse', 'terminal', 'desk')),
  is_system boolean not null default true,
  is_protected boolean not null default false,
  is_destructive boolean not null default false,
  is_approval_capable boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists permissions_permission_key_idx on public.permissions (permission_key);
create index if not exists permissions_module_code_idx on public.permissions (module_code);
create index if not exists permissions_category_code_idx on public.permissions (category_code);
create index if not exists permissions_risk_level_idx on public.permissions (risk_level);
create index if not exists permissions_is_active_idx on public.permissions (is_active);

drop trigger if exists permissions_set_updated_at on public.permissions;
create trigger permissions_set_updated_at
before update on public.permissions
for each row execute function public.set_updated_at();

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid null references public.tenants (id) on delete cascade,
  role_code text not null,
  name text not null,
  description text null,
  scope_type text not null default 'tenant' check (scope_type in ('tenant', 'branch', 'warehouse', 'terminal', 'desk')),
  template_version integer not null default 1,
  is_system boolean not null default false,
  is_protected boolean not null default false,
  is_active boolean not null default true,
  is_archived boolean not null default false,
  created_by uuid null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, role_code)
);

create index if not exists roles_tenant_id_idx on public.roles (tenant_id);
create index if not exists roles_role_code_idx on public.roles (role_code);
create index if not exists roles_is_system_idx on public.roles (is_system);
create index if not exists roles_is_active_idx on public.roles (is_active);
create index if not exists roles_is_archived_idx on public.roles (is_archived);

drop trigger if exists roles_set_updated_at on public.roles;
create trigger roles_set_updated_at
before update on public.roles
for each row execute function public.set_updated_at();

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  granted boolean not null default true,
  created_by uuid null,
  created_at timestamptz not null default now(),
  unique (role_id, permission_id)
);

create index if not exists role_permissions_role_id_idx on public.role_permissions (role_id);
create index if not exists role_permissions_permission_id_idx on public.role_permissions (permission_id);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  is_primary boolean not null default true,
  is_active boolean not null default true,
  assigned_by uuid null,
  assigned_at timestamptz not null default now(),
  expires_at timestamptz null
);

create index if not exists user_roles_tenant_id_idx on public.user_roles (tenant_id);
create index if not exists user_roles_user_id_idx on public.user_roles (user_id);
create index if not exists user_roles_role_id_idx on public.user_roles (role_id);
create index if not exists user_roles_is_active_idx on public.user_roles (is_active);

-- one active primary role per user per tenant (recommended)
drop index if exists user_roles_unique_primary_active;
create unique index user_roles_unique_primary_active
  on public.user_roles (tenant_id, user_id)
  where is_primary = true and is_active = true;

create table if not exists public.user_permission_overrides (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  override_type text not null check (override_type in ('grant', 'deny')),
  reason text null,
  is_active boolean not null default true,
  created_by uuid null,
  created_at timestamptz not null default now(),
  expires_at timestamptz null,
  unique (tenant_id, user_id, permission_id, override_type)
);

create index if not exists user_permission_overrides_tenant_id_idx on public.user_permission_overrides (tenant_id);
create index if not exists user_permission_overrides_user_id_idx on public.user_permission_overrides (user_id);
create index if not exists user_permission_overrides_permission_id_idx on public.user_permission_overrides (permission_id);
create index if not exists user_permission_overrides_is_active_idx on public.user_permission_overrides (is_active);

create table if not exists public.user_access_scopes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  scope_entity_type text not null check (scope_entity_type in ('tenant', 'branch', 'warehouse', 'terminal', 'desk')),
  scope_entity_id uuid null,
  scope_code text null,
  access_level text not null default 'allowed' check (access_level in ('allowed', 'denied', 'read_only')),
  is_active boolean not null default true,
  created_by uuid null,
  created_at timestamptz not null default now(),
  expires_at timestamptz null
);

create index if not exists user_access_scopes_tenant_id_idx on public.user_access_scopes (tenant_id);
create index if not exists user_access_scopes_user_id_idx on public.user_access_scopes (user_id);
create index if not exists user_access_scopes_scope_entity_type_idx on public.user_access_scopes (scope_entity_type);
create index if not exists user_access_scopes_scope_entity_id_idx on public.user_access_scopes (scope_entity_id);
create index if not exists user_access_scopes_scope_code_idx on public.user_access_scopes (scope_code);
create index if not exists user_access_scopes_is_active_idx on public.user_access_scopes (is_active);

create table if not exists public.permission_dependencies (
  id uuid primary key default gen_random_uuid(),
  permission_id uuid not null references public.permissions (id) on delete cascade,
  depends_on_permission_id uuid not null references public.permissions (id) on delete cascade,
  dependency_type text not null default 'requires',
  created_at timestamptz not null default now(),
  unique (permission_id, depends_on_permission_id)
);

create index if not exists permission_dependencies_permission_id_idx on public.permission_dependencies (permission_id);
create index if not exists permission_dependencies_depends_on_permission_id_idx on public.permission_dependencies (depends_on_permission_id);

create table if not exists public.permission_audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid null references public.tenants (id) on delete set null,
  actor_user_id uuid null references auth.users (id) on delete set null,
  entity_type text not null,
  entity_id uuid null,
  action_code text not null,
  old_value jsonb null,
  new_value jsonb null,
  reason text null,
  metadata jsonb not null default '{}'::jsonb,
  ip_address text null,
  user_agent text null,
  created_at timestamptz not null default now()
);

create index if not exists permission_audit_logs_tenant_id_idx on public.permission_audit_logs (tenant_id);
create index if not exists permission_audit_logs_actor_user_id_idx on public.permission_audit_logs (actor_user_id);
create index if not exists permission_audit_logs_entity_type_idx on public.permission_audit_logs (entity_type);
create index if not exists permission_audit_logs_entity_id_idx on public.permission_audit_logs (entity_id);
create index if not exists permission_audit_logs_action_code_idx on public.permission_audit_logs (action_code);
create index if not exists permission_audit_logs_created_at_idx on public.permission_audit_logs (created_at desc);

comment on table public.permissions is 'RBAC permission registry (system + tenant). Stable permission_key is the API contract.';
comment on table public.roles is 'RBAC roles registry. System roles have tenant_id null. Tenant roles are tenant-scoped.';
comment on table public.role_permissions is 'Role → permission assignments.';
comment on table public.user_roles is 'User → role assignments (supports multiple roles; one primary active now).';
comment on table public.user_permission_overrides is 'User-level permission grants/denies (timeboxed if needed).';
comment on table public.user_access_scopes is 'Organizational scope constraints (tenant/branch/warehouse/terminal/desk).';
comment on table public.permission_dependencies is 'Parent-child permission dependency graph.';
comment on table public.permission_audit_logs is 'Immutable audit trail for RBAC governance changes.';

-- -----------------------------
-- 3) RLS / tenant safety
-- -----------------------------

alter table public.permissions enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.user_permission_overrides enable row level security;
alter table public.user_access_scopes enable row level security;
alter table public.permission_dependencies enable row level security;
alter table public.permission_audit_logs enable row level security;

-- Permissions registry is readable to authenticated users (enforcement is app/service layer later).
drop policy if exists permissions_select_authenticated on public.permissions;
create policy permissions_select_authenticated
  on public.permissions for select
  to authenticated
  using (is_active = true);

-- No direct writes to permissions via RLS (service role only).

-- Roles: readable for tenant members; includes global system roles (tenant_id is null)
drop policy if exists roles_select_tenant_member on public.roles;
create policy roles_select_tenant_member
  on public.roles for select
  to authenticated
  using (
    is_active = true
    and (
      tenant_id is null
      or tenant_id in (
        select tenant_id from public.tenant_members where user_id = (select auth.uid())
      )
    )
  );

-- Tenant owners/admins can manage tenant roles (not system roles)
drop policy if exists roles_write_tenant_admin on public.roles;
create policy roles_write_tenant_admin
  on public.roles for all
  to authenticated
  using (
    tenant_id in (
      select tenant_id from public.tenant_members
      where user_id = (select auth.uid())
        and role in ('owner', 'admin')
    )
    and is_system = false
  )
  with check (
    tenant_id in (
      select tenant_id from public.tenant_members
      where user_id = (select auth.uid())
        and role in ('owner', 'admin')
    )
    and is_system = false
  );

-- role_permissions: readable for tenant members; writable only by tenant owners/admins and only for tenant roles
drop policy if exists role_permissions_select_tenant_member on public.role_permissions;
create policy role_permissions_select_tenant_member
  on public.role_permissions for select
  to authenticated
  using (
    exists (
      select 1
      from public.roles r
      where r.id = role_permissions.role_id
        and r.is_active = true
        and (
          r.tenant_id is null
          or r.tenant_id in (
            select tenant_id from public.tenant_members where user_id = (select auth.uid())
          )
        )
    )
  );

drop policy if exists role_permissions_write_tenant_admin on public.role_permissions;
create policy role_permissions_write_tenant_admin
  on public.role_permissions for all
  to authenticated
  using (
    exists (
      select 1
      from public.roles r
      where r.id = role_permissions.role_id
        and r.tenant_id in (
          select tenant_id from public.tenant_members
          where user_id = (select auth.uid())
            and role in ('owner', 'admin')
        )
        and r.is_system = false
    )
  )
  with check (
    exists (
      select 1
      from public.roles r
      where r.id = role_permissions.role_id
        and r.tenant_id in (
          select tenant_id from public.tenant_members
          where user_id = (select auth.uid())
            and role in ('owner', 'admin')
        )
        and r.is_system = false
    )
  );

-- user_roles: tenant constrained
drop policy if exists user_roles_select_tenant_member on public.user_roles;
create policy user_roles_select_tenant_member
  on public.user_roles for select
  to authenticated
  using (
    tenant_id in (
      select tenant_id from public.tenant_members where user_id = (select auth.uid())
    )
  );

drop policy if exists user_roles_write_tenant_admin on public.user_roles;
create policy user_roles_write_tenant_admin
  on public.user_roles for all
  to authenticated
  using (
    tenant_id in (
      select tenant_id from public.tenant_members
      where user_id = (select auth.uid())
        and role in ('owner', 'admin')
    )
  )
  with check (
    tenant_id in (
      select tenant_id from public.tenant_members
      where user_id = (select auth.uid())
        and role in ('owner', 'admin')
    )
  );

-- user_permission_overrides: tenant constrained
drop policy if exists user_permission_overrides_select_tenant_member on public.user_permission_overrides;
create policy user_permission_overrides_select_tenant_member
  on public.user_permission_overrides for select
  to authenticated
  using (
    tenant_id in (
      select tenant_id from public.tenant_members where user_id = (select auth.uid())
    )
  );

drop policy if exists user_permission_overrides_write_tenant_admin on public.user_permission_overrides;
create policy user_permission_overrides_write_tenant_admin
  on public.user_permission_overrides for all
  to authenticated
  using (
    tenant_id in (
      select tenant_id from public.tenant_members
      where user_id = (select auth.uid())
        and role in ('owner', 'admin')
    )
  )
  with check (
    tenant_id in (
      select tenant_id from public.tenant_members
      where user_id = (select auth.uid())
        and role in ('owner', 'admin')
    )
  );

-- user_access_scopes: tenant constrained
drop policy if exists user_access_scopes_select_tenant_member on public.user_access_scopes;
create policy user_access_scopes_select_tenant_member
  on public.user_access_scopes for select
  to authenticated
  using (
    tenant_id in (
      select tenant_id from public.tenant_members where user_id = (select auth.uid())
    )
  );

drop policy if exists user_access_scopes_write_tenant_admin on public.user_access_scopes;
create policy user_access_scopes_write_tenant_admin
  on public.user_access_scopes for all
  to authenticated
  using (
    tenant_id in (
      select tenant_id from public.tenant_members
      where user_id = (select auth.uid())
        and role in ('owner', 'admin')
    )
  )
  with check (
    tenant_id in (
      select tenant_id from public.tenant_members
      where user_id = (select auth.uid())
        and role in ('owner', 'admin')
    )
  );

-- permission_dependencies: readable to authenticated (active permissions only); writes service role only
drop policy if exists permission_dependencies_select_authenticated on public.permission_dependencies;
create policy permission_dependencies_select_authenticated
  on public.permission_dependencies for select
  to authenticated
  using (true);

-- permission_audit_logs: tenant constrained for select; insert allowed to tenant admins (service layer will standardize)
drop policy if exists permission_audit_logs_select_tenant_member on public.permission_audit_logs;
create policy permission_audit_logs_select_tenant_member
  on public.permission_audit_logs for select
  to authenticated
  using (
    tenant_id is null
    or tenant_id in (
      select tenant_id from public.tenant_members where user_id = (select auth.uid())
    )
  );

drop policy if exists permission_audit_logs_insert_tenant_admin on public.permission_audit_logs;
create policy permission_audit_logs_insert_tenant_admin
  on public.permission_audit_logs for insert
  to authenticated
  with check (
    tenant_id is null
    or tenant_id in (
      select tenant_id from public.tenant_members
      where user_id = (select auth.uid())
        and role in ('owner', 'admin')
    )
  );

-- -----------------------------
-- 4) Seed: permissions
-- -----------------------------

with seed as (
  select * from (
    values
      -- SYSTEM ADMINISTRATION
      ('system.roles.manage','Manage roles','Create/edit/archive roles and templates.','system','system','roles','manage','critical','tenant',true,true,false,false,10),
      ('system.roles.assign','Assign roles','Assign roles to staff users.','system','system','roles','assign','critical','tenant',true,true,false,false,20),
      ('system.users.manage','Manage users','Create/edit/suspend/reactivate staff users.','system','system','users','manage','critical','tenant',true,true,false,false,30),
      ('system.users.reset_password','Reset passwords','Reset staff user passwords / credentials.','system','system','users','reset_password','high','tenant',true,true,false,false,40),
      ('system.security.manage','Manage security','Manage security rules, sessions, and enforcement settings.','system','security','security','manage','critical','tenant',true,true,false,false,50),
      ('system.settings.manage','Manage settings','Manage app settings and governance configurations.','system','system','settings','manage','critical','tenant',true,true,false,false,60),
      ('system.billing.manage','Manage billing','Billing, activation, subscriptions, invoices.','system','billing','billing','manage','critical','tenant',true,true,false,false,70),
      ('system.integrations.manage','Manage integrations','Configure external integrations and keys.','system','system','integrations','manage','critical','tenant',true,true,false,false,80),
      ('system.audit.view','View audit','View security and governance audit logs.','system','audit','audit','view','high','tenant',true,true,false,false,90),
      ('system.audit.export','Export audit','Export security audit logs.','system','audit','audit','export','critical','tenant',true,true,true,false,100),

      -- DESK ACCESS
      ('desk.sysadmin.access','Access SysAdmin Desk','Access SysAdmin Desk surfaces.','desk','desk','sysadmin','access','low','desk',true,true,false,false,110),
      ('desk.executive.access','Access Executive Desk','Access executive overview desk.','desk','desk','executive','access','low','desk',true,false,false,false,120),
      ('desk.branch.access','Access Branch Desk','Access branch management desk.','desk','desk','branch','access','low','desk',true,false,false,false,130),
      ('desk.inventory.access','Access Inventory Desk','Access inventory desk tools.','desk','desk','inventory','access','low','desk',true,false,false,false,140),
      ('desk.pos.access','Access POS Desk','Access POS desk/terminal.','desk','desk','pos','access','low','desk',true,false,false,false,150),
      ('desk.procurement.access','Access Procurement Desk','Access procurement desk.','desk','desk','procurement','access','low','desk',true,false,false,false,160),
      ('desk.finance.access','Access Finance Desk','Access finance desk.','desk','desk','finance','access','low','desk',true,false,false,false,170),
      ('desk.reports.access','Access Reports Desk','Access reports desk.','desk','desk','reports','access','low','desk',true,false,false,false,180),
      ('desk.delivery.access','Access Delivery Desk','Access delivery desk.','desk','desk','delivery','access','low','desk',true,false,false,false,190),
      ('desk.consignment.access','Access Consignment Desk','Access consignment desk.','desk','desk','consignment','access','low','desk',true,false,false,false,200),
      ('desk.help.access','Access Help Desk','Access help desk / support tools.','desk','desk','help','access','low','desk',true,false,false,false,210),
      ('desk.poolwise.access','Access PoolWise Desk','Access PoolWise desk.','desk','desk','poolwise','access','low','desk',true,false,false,false,220),

      -- STAFF MANAGEMENT
      ('staff.user.create','Create staff user','Create staff user accounts.','staff','staff','user','create','high','tenant',true,false,false,false,300),
      ('staff.user.edit','Edit staff user','Edit staff user accounts.','staff','staff','user','edit','high','tenant',true,false,false,false,310),
      ('staff.user.suspend','Suspend staff user','Suspend staff users.','staff','staff','user','suspend','high','tenant',true,false,false,false,320),
      ('staff.user.reactivate','Reactivate staff user','Reactivate suspended staff users.','staff','staff','user','reactivate','high','tenant',true,false,false,false,330),
      ('staff.user.assign_branch','Assign branch','Assign staff to branch.','staff','staff','user','assign_branch','medium','branch',true,false,false,false,340),
      ('staff.user.assign_terminal','Assign terminal','Assign staff to terminal.','staff','staff','user','assign_terminal','medium','terminal',true,false,false,false,350),
      ('staff.user.assign_supervisor','Assign supervisor','Assign staff supervisor relationships.','staff','staff','user','assign_supervisor','medium','tenant',true,false,false,false,360),
      ('staff.user.view_activity','View staff activity','View staff activity logs.','staff','staff','user','view_activity','medium','tenant',true,false,false,false,370),
      ('staff.user.scope_manage','Manage staff scope','Manage staff access scopes (branch/terminal/desk).','staff','staff','user','scope_manage','critical','tenant',true,false,false,false,380),

      -- POS / SALES
      ('pos.shift.open','Open shift','Open POS shift.','pos','pos','shift','open','low','terminal',true,false,false,false,400),
      ('pos.shift.close','Close shift','Close POS shift.','pos','pos','shift','close','low','terminal',true,false,false,false,410),
      ('pos.sale.create','Create sale','Create and complete sale.','pos','pos','sale','create','low','terminal',true,false,false,false,420),
      ('pos.sale.suspend','Suspend sale','Suspend an in-progress sale.','pos','pos','sale','suspend','low','terminal',true,false,false,false,430),
      ('pos.sale.resume','Resume sale','Resume suspended sale.','pos','pos','sale','resume','low','terminal',true,false,false,false,440),
      ('pos.discount.line_apply','Apply line discount','Apply discount on a line item.','pos','pos','discount','line_apply','medium','terminal',true,false,false,false,450),
      ('pos.discount.invoice_apply','Apply invoice discount','Apply discount on invoice total.','pos','pos','discount','invoice_apply','medium','terminal',true,false,false,false,460),
      ('pos.price.override','Override price','Change selling price at sale time.','pos','pos','price','override','high','terminal',true,false,false,true,470),
      ('pos.price.floor_override','Override price floor','Override price floor controls.','pos','pos','price','floor_override','critical','terminal',true,false,false,true,480),
      ('pos.return.full','Full return','Process full return.','pos','pos','return','full','high','terminal',true,false,false,true,490),
      ('pos.return.partial','Partial return','Process partial return.','pos','pos','return','partial','high','terminal',true,false,false,true,500),
      ('pos.sale.void_line','Void line item','Void a line item.','pos','pos','sale','void_line','high','terminal',true,false,false,true,510),
      ('pos.sale.void','Void sale','Void full sale.','pos','pos','sale','void','high','terminal',true,false,false,true,520),
      ('pos.receipt.reprint','Reprint receipt','Reprint receipt copy.','pos','pos','receipt','reprint','low','terminal',true,false,false,false,530),
      ('pos.receipt.cancel','Cancel receipt','Cancel receipt.','pos','pos','receipt','cancel','high','terminal',true,false,true,true,540),
      ('pos.cash_movement.cash_in','Cash in','Record cash in.','pos','pos','cash_movement','cash_in','medium','terminal',true,false,false,false,550),
      ('pos.cash_movement.cash_out','Cash out','Record cash out.','pos','pos','cash_movement','cash_out','medium','terminal',true,false,false,false,560),
      ('pos.drawer.open','Open cash drawer','Open cash drawer.','pos','pos','drawer','open','low','terminal',true,false,false,false,570),
      ('pos.sales.view_own','View own sales','View own sales history.','pos','pos','sales','view_own','low','tenant',true,false,false,false,580),
      ('pos.sales.view_all','View all sales','View all sales across staff/terminals.','pos','pos','sales','view_all','medium','tenant',true,false,false,false,590),
      ('pos.sale.reopen','Reopen closed sale','Reopen closed sale/receipt.','pos','pos','sale','reopen','high','terminal',true,false,false,true,600),

      -- INVENTORY
      ('inventory.product.create','Create product','Create products.','inventory','inventory','product','create','medium','tenant',true,false,false,false,700),
      ('inventory.product.edit','Edit product','Edit products.','inventory','inventory','product','edit','medium','tenant',true,false,false,false,710),
      ('inventory.product.delete','Delete product','Delete products (destructive).','inventory','inventory','product','delete','critical','tenant',true,false,true,true,720),
      ('inventory.product.import','Import products','Import product catalogue.','inventory','inventory','product','import','medium','tenant',true,false,false,false,730),
      ('inventory.product.export','Export products','Export product list.','inventory','inventory','product','export','medium','tenant',true,false,false,false,740),
      ('inventory.category.manage','Manage categories','Manage product categories.','inventory','inventory','category','manage','medium','tenant',true,false,false,false,750),
      ('inventory.attribute.manage','Manage attributes','Manage product attributes.','inventory','inventory','attribute','manage','medium','tenant',true,false,false,false,760),
      ('inventory.image.upload','Upload images','Upload/manage product images.','inventory','inventory','image','upload','medium','tenant',true,false,false,false,770),
      ('inventory.adjustment.create','Create adjustment','Create stock adjustment request.','inventory','inventory','adjustment','create','medium','branch',true,false,false,true,780),
      ('inventory.adjustment.approve','Approve adjustment','Approve stock adjustment.','inventory','inventory','adjustment','approve','high','branch',true,false,false,true,790),
      ('inventory.adjustment.post','Post adjustment','Post stock adjustment to ledger/on-hand.','inventory','inventory','adjustment','post','high','branch',true,false,false,true,800),
      ('inventory.transfer.create','Create transfer','Create stock transfer.','inventory','inventory','transfer','create','medium','branch',true,false,false,false,810),
      ('inventory.transfer.approve','Approve transfer','Approve stock transfer.','inventory','inventory','transfer','approve','high','branch',true,false,false,true,820),
      ('inventory.receipt.receive','Receive stock','Receive goods into inventory.','inventory','inventory','receipt','receive','medium','branch',true,false,false,false,830),
      ('inventory.receipt.approve','Approve receipt','Approve goods received note.','inventory','inventory','receipt','approve','high','branch',true,false,false,true,840),
      ('inventory.count.perform','Perform stock count','Perform stock count.','inventory','inventory','count','perform','medium','branch',true,false,false,false,850),
      ('inventory.variance.post','Post variance','Post stock count variance.','inventory','inventory','variance','post','high','branch',true,false,false,true,860),
      ('inventory.barcode.print','Print barcodes','Print/manage barcode labels.','inventory','inventory','barcode','print','low','branch',true,false,false,false,870),
      ('inventory.bundle.manage','Manage bundles','Create/manage bundles & conversions.','inventory','inventory','bundle','manage','medium','tenant',true,false,false,false,880),
      ('inventory.valuation.view','View valuation','View stock valuation reports.','inventory','inventory','valuation','view','low','tenant',true,false,false,false,890),

      -- PROCUREMENT
      ('procurement.supplier.create','Create supplier','Create supplier records.','procurement','procurement','supplier','create','medium','tenant',true,false,false,false,1000),
      ('procurement.supplier.edit','Edit supplier','Edit supplier records.','procurement','procurement','supplier','edit','medium','tenant',true,false,false,false,1010),
      ('procurement.po.create','Create purchase order','Create purchase orders.','procurement','procurement','po','create','medium','tenant',true,false,false,false,1020),
      ('procurement.po.edit','Edit purchase order','Edit purchase orders.','procurement','procurement','po','edit','medium','tenant',true,false,false,false,1030),
      ('procurement.po.approve','Approve purchase order','Approve purchase orders.','procurement','procurement','po','approve','high','tenant',true,false,false,true,1040),
      ('procurement.po.cancel','Cancel purchase order','Cancel purchase orders.','procurement','procurement','po','cancel','high','tenant',true,false,true,true,1050),
      ('procurement.receipt.receive','Receive against PO','Receive goods against PO.','procurement','procurement','receipt','receive','medium','branch',true,false,false,false,1060),
      ('procurement.settings.manage','Manage procurement settings','Manage procurement settings.','procurement','procurement','settings','manage','high','tenant',true,false,false,false,1070),

      -- FINANCE / CASHPLAN
      ('finance.dashboard.view','View finance dashboard','View financial overview dashboards.','finance','finance','dashboard','view','low','tenant',true,false,false,false,1200),
      ('finance.expense.record','Record expense','Record expenses.','finance','finance','expense','record','medium','tenant',true,false,false,false,1210),
      ('finance.expense.approve','Approve expense','Approve expenses.','finance','finance','expense','approve','high','tenant',true,false,false,true,1220),
      ('finance.expense.reverse','Reverse expense','Reverse expenses.','finance','finance','expense','reverse','high','tenant',true,false,false,true,1230),
      ('finance.reserve_account.manage','Manage reserves','Manage reserve accounts.','finance','finance','reserve_account','manage','high','tenant',true,false,false,true,1240),
      ('finance.creditor_schedule.manage','Manage creditor schedules','Manage creditor schedules.','finance','finance','creditor_schedule','manage','medium','tenant',true,false,false,true,1250),
      ('finance.journal.post','Post journal','Post general journal.','finance','finance','journal','post','high','tenant',true,false,false,true,1260),
      ('finance.journal.reverse','Reverse journal','Reverse journal entries.','finance','finance','journal','reverse','critical','tenant',true,false,false,true,1270),
      ('finance.period.lock','Lock period','Lock accounting period.','finance','finance','period','lock','high','tenant',true,false,false,true,1280),
      ('finance.period.reopen','Reopen period','Reopen accounting period.','finance','finance','period','reopen','critical','tenant',true,false,false,true,1290),
      ('finance.report.export','Export finance report','Export finance reports.','finance','finance','report','export','high','tenant',true,false,false,false,1300),

      -- APPROVALS
      ('approval.request.create','Create approval request','Create approval requests.','approval','approval','request','create','medium','tenant',true,false,false,false,1400),
      ('approval.request.approve_low','Approve low-risk','Approve low-risk approval requests.','approval','approval','request','approve_low','high','tenant',true,false,false,true,1410),
      ('approval.request.approve_high','Approve high-risk','Approve high/critical requests.','approval','approval','request','approve_high','critical','tenant',true,false,false,true,1420),
      ('approval.request.reject','Reject request','Reject approval requests.','approval','approval','request','reject','high','tenant',true,false,false,true,1430),
      ('approval.request.escalate','Escalate request','Escalate approval requests.','approval','approval','request','escalate','high','tenant',true,false,false,true,1440),
      ('approval.request.delegate','Delegate approval','Delegate approval responsibilities.','approval','approval','request','delegate','high','tenant',true,false,false,true,1450),
      ('approval.request.override','Override approval chain','Override approval chain/policy.','approval','approval','request','override','critical','tenant',true,true,false,true,1460),
      ('approval.history.view','View approval history','View approval history.','approval','approval','history','view','medium','tenant',true,false,false,false,1470),

      -- REPORTS / BI
      ('reports.view','View reports','View reporting dashboards.','reports','reports','reports','view','low','tenant',true,false,false,false,1600),
      ('reports.export','Export reports','Export reports.','reports','reports','reports','export','medium','tenant',true,false,false,false,1610),
      ('reports.schedule','Schedule reports','Schedule report delivery.','reports','reports','reports','schedule','medium','tenant',true,false,false,false,1620),
      ('reports.branch.view','View branch reports','View branch-scoped reports.','reports','reports','branch','view','low','branch',true,false,false,false,1630),
      ('reports.tenant.view','View tenant reports','View multi-branch/tenant reports.','reports','reports','tenant','view','low','tenant',true,false,false,false,1640),
      ('reports.profit.view','View profit reports','View profit & margin reports.','reports','reports','profit','view','low','tenant',true,false,false,false,1650),
      ('reports.audit.view','View audit reports','View audit/controls reports.','reports','reports','audit','view','medium','tenant',true,false,false,false,1660),
      ('reports.bi.view','View BI insights','View BI insights and rules.','reports','bi','bi','view','low','tenant',true,false,false,false,1670),

      -- STOREFRONT / MARKET
      ('storefront.create','Create storefront','Create storefront.','storefront','market','storefront','create','medium','tenant',true,false,false,false,1800),
      ('storefront.edit','Edit storefront','Edit storefront.','storefront','market','storefront','edit','medium','tenant',true,false,false,false,1810),
      ('storefront.publish','Publish storefront','Publish storefront.','storefront','market','storefront','publish','high','tenant',true,false,false,true,1820),
      ('storefront.unpublish','Unpublish storefront','Unpublish storefront.','storefront','market','storefront','unpublish','high','tenant',true,false,false,true,1830),
      ('catalogue.generate','Generate catalogue','Generate catalogue exports.','storefront','market','catalogue','generate','medium','tenant',true,false,false,false,1840),
      ('marketplace.product.publish','Publish marketplace product','Publish products to marketplace.','storefront','market','marketplace_product','publish','medium','tenant',true,false,false,false,1850),
      ('marketplace.product.unpublish','Unpublish marketplace product','Unpublish marketplace products.','storefront','market','marketplace_product','unpublish','medium','tenant',true,false,false,false,1860),
      ('marketplace.promotion.manage','Manage promotions','Manage promos/banners.','storefront','market','promotion','manage','high','tenant',true,false,false,true,1870),
      ('storefront.asset.share','Share storefront','Share storefront assets/links.','storefront','market','asset','share','low','tenant',true,false,false,false,1880),

      -- DELIVERY
      ('delivery.dispatch.create','Create dispatch','Create dispatch records.','delivery','delivery','dispatch','create','medium','tenant',true,false,false,false,2000),
      ('delivery.dispatch.assign','Assign rider','Assign rider/driver.','delivery','delivery','dispatch','assign','medium','tenant',true,false,false,false,2010),
      ('delivery.pickup.confirm','Confirm pickup','Confirm pickup.','delivery','delivery','pickup','confirm','medium','tenant',true,false,false,false,2020),
      ('delivery.confirmation.complete','Complete delivery','Mark delivery complete.','delivery','delivery','confirmation','complete','medium','tenant',true,false,false,false,2030),
      ('delivery.dispatch.cancel','Cancel dispatch','Cancel dispatch.','delivery','delivery','dispatch','cancel','high','tenant',true,false,true,true,2040),
      ('delivery.tracking.view','View tracking','View delivery tracking.','delivery','delivery','tracking','view','low','tenant',true,false,false,false,2050),
      ('delivery.exception.approve','Approve exceptions','Approve delivery exceptions.','delivery','delivery','exception','approve','high','tenant',true,false,false,true,2060),

      -- CONSIGNMENT
      ('consignment.agreement.create','Create agreement','Create consignment agreement draft.','consignment','consignment','agreement','create','high','tenant',true,false,false,true,2200),
      ('consignment.stock.edit','Edit consignment stock','Edit consignment stock issues/returns.','consignment','consignment','stock','edit','high','branch',true,false,false,true,2210),
      ('consignment.settlement.run','Run settlement','Run consignment settlement cycle.','consignment','consignment','settlement','run','high','tenant',true,false,false,true,2220),
      ('consignment.settlement.approve','Approve settlement','Approve consignment settlement.','consignment','consignment','settlement','approve','high','tenant',true,false,false,true,2230),
      ('consignment.cycle.close','Close cycle','Close consignment cycle.','consignment','consignment','cycle','close','high','tenant',true,false,false,true,2240),
      ('consignment.ledger.principal_view','View principal ledger','View principal consignment ledger.','consignment','consignment','ledger','principal_view','medium','tenant',true,false,false,false,2250),
      ('consignment.ledger.agent_view','View agent ledger','View agent consignment ledger.','consignment','consignment','ledger','agent_view','medium','tenant',true,false,false,false,2260),

      -- SECURITY / ADVANCED
      ('security.login_history.view','View login history','View login history.','security','security','login_history','view','high','tenant',true,false,false,false,2400),
      ('security.session.force_logout','Force logout','Force logout a user session.','security','security','session','force_logout','high','tenant',true,false,false,true,2410),
      ('security.event.investigate','Investigate event','Mark events for investigation.','security','security','event','investigate','high','tenant',true,false,false,false,2420),
      ('security.mfa.manage','Manage MFA','Manage MFA settings.','security','security','mfa','manage','critical','tenant',true,true,false,false,2430),
      ('security.policy.manage','Manage security policy','Manage security policies.','security','security','policy','manage','critical','tenant',true,true,false,false,2440)
  ) as t(
    permission_key,label,description,module_code,category_code,resource_code,action_code,risk_level,scope_type,
    is_system,is_protected,is_destructive,is_approval_capable,sort_order
  )
)
insert into public.permissions (
  permission_key,label,description,module_code,category_code,resource_code,action_code,risk_level,scope_type,
  is_system,is_protected,is_destructive,is_approval_capable,is_active,sort_order,metadata
)
select
  permission_key,label,description,module_code,category_code,resource_code,action_code,risk_level,scope_type,
  is_system,is_protected,is_destructive,is_approval_capable,true,sort_order,'{}'::jsonb
from seed
on conflict (permission_key) do update set
  label = excluded.label,
  description = excluded.description,
  module_code = excluded.module_code,
  category_code = excluded.category_code,
  resource_code = excluded.resource_code,
  action_code = excluded.action_code,
  risk_level = excluded.risk_level,
  scope_type = excluded.scope_type,
  is_system = excluded.is_system,
  is_protected = excluded.is_protected,
  is_destructive = excluded.is_destructive,
  is_approval_capable = excluded.is_approval_capable,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata,
  updated_at = now();

-- -----------------------------
-- 5) Seed: system roles (tenant_id = null)
-- -----------------------------

with seed as (
  select * from (
    values
      ('sys_admin','SysAdmin','Full governance role with all permissions.','tenant',1,true,true,true),
      ('owner','Owner','Business owner with broad oversight and approvals.','tenant',1,true,false,true),
      ('director','Director','Executive director role.','tenant',1,true,false,true),
      ('general_manager','General Manager','General manager with operational oversight.','tenant',1,true,false,true),
      ('branch_manager','Branch Manager','Branch operations manager.','branch',1,true,false,true),
      ('store_supervisor','Store Supervisor','Store supervisor with POS and inventory supervision.','branch',1,true,false,true),
      ('cashier','Cashier','Terminal user: sales operations only.','terminal',1,true,false,true),
      ('inventory_clerk','Inventory Clerk','Inventory operations user.','branch',1,true,false,true),
      ('accountant','Accountant','Finance operations and reporting.','tenant',1,true,false,true),
      ('procurement_officer','Procurement Officer','Procurement and supplier operations.','tenant',1,true,false,true),
      ('warehouse_officer','Warehouse Officer','Warehouse receiving and stock movement.','branch',1,true,false,true),
      ('dispatch_officer','Dispatch Officer','Delivery and dispatch operations.','tenant',1,true,false,true),
      ('customer_service','Customer Service','Customer service desk and limited reporting.','tenant',1,true,false,true),
      ('auditor','Auditor','Read-only audit and reporting.','tenant',1,true,false,true),
      ('read_only_analyst','Read-Only Analyst','Read-only BI and reports.','tenant',1,true,false,true)
  ) as t(role_code,name,description,scope_type,template_version,is_system,is_protected,is_active)
)
insert into public.roles (
  tenant_id, role_code, name, description, scope_type, template_version,
  is_system, is_protected, is_active, is_archived, created_by, updated_by
)
select
  null, role_code, name, description, scope_type, template_version,
  is_system, is_protected, is_active, false, null, null
from seed
on conflict (tenant_id, role_code) do update set
  name = excluded.name,
  description = excluded.description,
  scope_type = excluded.scope_type,
  template_version = excluded.template_version,
  is_system = excluded.is_system,
  is_protected = excluded.is_protected,
  is_active = excluded.is_active,
  is_archived = excluded.is_archived,
  updated_at = now();

-- -----------------------------
-- 6) Seed: role-permission mappings
-- -----------------------------

-- SysAdmin: grant all permissions
insert into public.role_permissions (role_id, permission_id, granted, created_by)
select r.id, p.id, true, null
from public.roles r
cross join public.permissions p
where r.tenant_id is null
  and r.role_code = 'sys_admin'
on conflict (role_id, permission_id) do nothing;

-- Other roles: curated defaults
with rp(role_code, permission_key) as (
  values
    -- OWNER
    ('owner','desk.executive.access'),
    ('owner','desk.branch.access'),
    ('owner','desk.inventory.access'),
    ('owner','desk.pos.access'),
    ('owner','desk.procurement.access'),
    ('owner','desk.finance.access'),
    ('owner','desk.reports.access'),
    ('owner','desk.delivery.access'),
    ('owner','desk.consignment.access'),
    ('owner','desk.poolwise.access'),
    ('owner','reports.view'),
    ('owner','reports.export'),
    ('owner','reports.tenant.view'),
    ('owner','reports.profit.view'),
    ('owner','reports.audit.view'),
    ('owner','reports.bi.view'),
    ('owner','finance.dashboard.view'),
    ('owner','finance.expense.record'),
    ('owner','finance.expense.approve'),
    ('owner','finance.reserve_account.manage'),
    ('owner','finance.journal.post'),
    ('owner','finance.period.lock'),
    ('owner','finance.report.export'),
    ('owner','approval.request.create'),
    ('owner','approval.request.approve_low'),
    ('owner','approval.request.approve_high'),
    ('owner','approval.request.reject'),
    ('owner','approval.request.escalate'),
    ('owner','approval.history.view'),
    ('owner','system.audit.view'),
    ('owner','system.billing.manage'),
    ('owner','security.login_history.view'),
    ('owner','security.session.force_logout'),

    -- DIRECTOR
    ('director','desk.executive.access'),
    ('director','desk.branch.access'),
    ('director','desk.finance.access'),
    ('director','desk.reports.access'),
    ('director','reports.view'),
    ('director','reports.export'),
    ('director','reports.tenant.view'),
    ('director','reports.profit.view'),
    ('director','finance.dashboard.view'),
    ('director','approval.request.create'),
    ('director','approval.request.approve_low'),
    ('director','approval.request.approve_high'),
    ('director','approval.history.view'),
    ('director','system.audit.view'),

    -- GENERAL MANAGER
    ('general_manager','desk.executive.access'),
    ('general_manager','desk.branch.access'),
    ('general_manager','desk.inventory.access'),
    ('general_manager','desk.pos.access'),
    ('general_manager','desk.procurement.access'),
    ('general_manager','desk.finance.access'),
    ('general_manager','desk.reports.access'),
    ('general_manager','desk.delivery.access'),
    ('general_manager','desk.consignment.access'),
    ('general_manager','reports.view'),
    ('general_manager','reports.export'),
    ('general_manager','finance.dashboard.view'),
    ('general_manager','finance.expense.record'),
    ('general_manager','approval.request.create'),
    ('general_manager','approval.request.approve_low'),
    ('general_manager','approval.request.reject'),
    ('general_manager','approval.history.view'),

    -- BRANCH MANAGER
    ('branch_manager','desk.branch.access'),
    ('branch_manager','desk.inventory.access'),
    ('branch_manager','desk.pos.access'),
    ('branch_manager','desk.reports.access'),
    ('branch_manager','pos.shift.open'),
    ('branch_manager','pos.shift.close'),
    ('branch_manager','pos.sale.create'),
    ('branch_manager','pos.sale.suspend'),
    ('branch_manager','pos.sale.resume'),
    ('branch_manager','pos.receipt.reprint'),
    ('branch_manager','pos.sales.view_all'),
    ('branch_manager','inventory.product.create'),
    ('branch_manager','inventory.product.edit'),
    ('branch_manager','inventory.receipt.receive'),
    ('branch_manager','inventory.receipt.approve'),
    ('branch_manager','inventory.count.perform'),
    ('branch_manager','inventory.variance.post'),
    ('branch_manager','reports.view'),
    ('branch_manager','reports.branch.view'),
    ('branch_manager','reports.export'),
    ('branch_manager','staff.user.view_activity'),

    -- STORE SUPERVISOR
    ('store_supervisor','desk.branch.access'),
    ('store_supervisor','desk.inventory.access'),
    ('store_supervisor','desk.pos.access'),
    ('store_supervisor','pos.shift.open'),
    ('store_supervisor','pos.shift.close'),
    ('store_supervisor','pos.sale.create'),
    ('store_supervisor','pos.sale.suspend'),
    ('store_supervisor','pos.sale.resume'),
    ('store_supervisor','pos.receipt.reprint'),
    ('store_supervisor','pos.sales.view_all'),
    ('store_supervisor','inventory.receipt.receive'),
    ('store_supervisor','inventory.count.perform'),
    ('store_supervisor','inventory.transfer.create'),
    ('store_supervisor','reports.view'),
    ('store_supervisor','reports.branch.view'),

    -- CASHIER (terminal-only by design)
    ('cashier','desk.pos.access'),
    ('cashier','pos.shift.open'),
    ('cashier','pos.shift.close'),
    ('cashier','pos.sale.create'),
    ('cashier','pos.sale.suspend'),
    ('cashier','pos.sale.resume'),
    ('cashier','pos.receipt.reprint'),
    ('cashier','pos.sales.view_own'),
    ('cashier','pos.drawer.open'),
    ('cashier','pos.cash_movement.cash_in'),
    ('cashier','pos.cash_movement.cash_out'),

    -- INVENTORY CLERK
    ('inventory_clerk','desk.inventory.access'),
    ('inventory_clerk','inventory.product.create'),
    ('inventory_clerk','inventory.product.edit'),
    ('inventory_clerk','inventory.receipt.receive'),
    ('inventory_clerk','inventory.count.perform'),
    ('inventory_clerk','inventory.transfer.create'),
    ('inventory_clerk','inventory.barcode.print'),
    ('inventory_clerk','inventory.valuation.view'),

    -- ACCOUNTANT
    ('accountant','desk.finance.access'),
    ('accountant','desk.reports.access'),
    ('accountant','finance.dashboard.view'),
    ('accountant','finance.expense.record'),
    ('accountant','finance.journal.post'),
    ('accountant','finance.period.lock'),
    ('accountant','finance.report.export'),
    ('accountant','reports.view'),
    ('accountant','reports.export'),
    ('accountant','approval.request.create'),
    ('accountant','approval.history.view'),

    -- PROCUREMENT OFFICER
    ('procurement_officer','desk.procurement.access'),
    ('procurement_officer','procurement.supplier.create'),
    ('procurement_officer','procurement.supplier.edit'),
    ('procurement_officer','procurement.po.create'),
    ('procurement_officer','procurement.po.edit'),
    ('procurement_officer','procurement.receipt.receive'),

    -- WAREHOUSE OFFICER
    ('warehouse_officer','desk.inventory.access'),
    ('warehouse_officer','inventory.receipt.receive'),
    ('warehouse_officer','inventory.transfer.create'),
    ('warehouse_officer','inventory.count.perform'),
    ('warehouse_officer','inventory.valuation.view'),

    -- DISPATCH OFFICER
    ('dispatch_officer','desk.delivery.access'),
    ('dispatch_officer','delivery.dispatch.create'),
    ('dispatch_officer','delivery.dispatch.assign'),
    ('dispatch_officer','delivery.pickup.confirm'),
    ('dispatch_officer','delivery.confirmation.complete'),
    ('dispatch_officer','delivery.tracking.view'),

    -- CUSTOMER SERVICE
    ('customer_service','desk.help.access'),
    ('customer_service','reports.view'),
    ('customer_service','reports.branch.view'),

    -- AUDITOR
    ('auditor','desk.reports.access'),
    ('auditor','reports.view'),
    ('auditor','reports.tenant.view'),
    ('auditor','reports.audit.view'),
    ('auditor','system.audit.view'),
    ('auditor','security.login_history.view'),

    -- READ ONLY ANALYST
    ('read_only_analyst','desk.reports.access'),
    ('read_only_analyst','reports.view'),
    ('read_only_analyst','reports.bi.view'),
    ('read_only_analyst','reports.tenant.view')
),
resolved as (
  select
    r.id as role_id,
    p.id as permission_id
  from rp
  join public.roles r on r.tenant_id is null and r.role_code = rp.role_code
  join public.permissions p on p.permission_key = rp.permission_key
)
insert into public.role_permissions (role_id, permission_id, granted, created_by)
select role_id, permission_id, true, null
from resolved
on conflict (role_id, permission_id) do nothing;

-- -----------------------------
-- 7) Seed: permission dependencies
-- -----------------------------

with deps(permission_key, depends_on_key) as (
  values
    ('system.roles.manage','desk.sysadmin.access'),
    ('system.roles.assign','desk.sysadmin.access'),
    ('system.users.manage','desk.sysadmin.access'),
    ('system.audit.export','system.audit.view'),
    ('pos.sale.create','desk.pos.access'),
    ('pos.shift.open','desk.pos.access'),
    ('inventory.product.create','desk.inventory.access'),
    ('inventory.adjustment.post','inventory.adjustment.approve'),
    ('inventory.adjustment.approve','desk.inventory.access'),
    ('finance.expense.approve','desk.finance.access'),
    ('finance.period.reopen','desk.finance.access'),
    ('approval.request.approve_high','approval.request.approve_low'),
    ('reports.export','reports.view'),
    ('reports.audit.view','desk.reports.access'),
    ('delivery.dispatch.assign','desk.delivery.access'),
    ('consignment.settlement.approve','desk.consignment.access')
),
resolved as (
  select
    p.id as permission_id,
    d.id as depends_on_permission_id
  from deps
  join public.permissions p on p.permission_key = deps.permission_key
  join public.permissions d on d.permission_key = deps.depends_on_key
)
insert into public.permission_dependencies (permission_id, depends_on_permission_id, dependency_type)
select permission_id, depends_on_permission_id, 'requires'
from resolved
on conflict (permission_id, depends_on_permission_id) do nothing;

