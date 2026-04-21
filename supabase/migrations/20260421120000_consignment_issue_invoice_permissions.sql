-- Consignment Issue Invoice permissions + dependencies
-- Adds RBAC permission keys used by the Consignment Issue Invoice module UI.

-- 1) Permissions (system-level, tenant_id null)
insert into public.permissions (
  permission_key,
  label,
  description,
  module_code,
  category_code,
  resource_code,
  action_code,
  risk_level,
  scope_type,
  is_system,
  is_protected,
  is_destructive,
  is_approval_capable,
  sort_order,
  is_active,
  metadata
)
values
  (
    'consignment.issue_invoice.create',
    'Create issue invoice',
    'Draft and submit consignment issue invoices from principal warehouse to agent stalls.',
    'consignment',
    'consignment',
    'issue_invoice',
    'create',
    'high',
    'branch',
    true,
    false,
    false,
    true,
    2265,
    true,
    '{}'::jsonb
  ),
  (
    'consignment.issue_invoice.approve',
    'Approve issue invoice',
    'Approve/reject consignment issue invoices. Approval releases sellable stock to agent stalls and posts accounting entries.',
    'consignment',
    'consignment',
    'issue_invoice',
    'approve',
    'high',
    'branch',
    true,
    false,
    false,
    true,
    2270,
    true,
    '{}'::jsonb
  )
on conflict (permission_key) do update
set
  label = excluded.label,
  description = excluded.description,
  module_code = excluded.module_code,
  category_code = excluded.category_code,
  resource_code = excluded.resource_code,
  action_code = excluded.action_code,
  risk_level = excluded.risk_level,
  scope_type = excluded.scope_type,
  is_approval_capable = excluded.is_approval_capable,
  is_active = excluded.is_active,
  metadata = excluded.metadata;

-- 2) Dependencies: require consignment desk access for approvals
insert into public.permission_dependencies (permission_id, depends_on_permission_id, dependency_type)
select p.id, d.id, 'requires'
from public.permissions p
join public.permissions d on d.permission_key = 'desk.consignment.access'
where p.permission_key in ('consignment.issue_invoice.create', 'consignment.issue_invoice.approve')
on conflict do nothing;

