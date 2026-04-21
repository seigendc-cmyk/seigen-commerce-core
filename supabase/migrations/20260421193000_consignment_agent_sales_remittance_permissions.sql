-- Consignment Agent operational permissions (mobile sales + cash remittance + POP governance)
-- Pack: Consignment Agent SOT (Agent mobile sales, remittance, POP approval)

begin;

-- Agent operations
insert into public.permissions (key, name, description, is_approval_capable)
values
  ('agent.sale.create', 'Agent: Create sale', 'Allow agent to complete a sale from stall issued stock.', false),
  ('agent.shift.open', 'Agent: Open shift', 'Allow agent to open a stall trading shift.', false),
  ('agent.shift.close', 'Agent: Close shift', 'Allow agent to close a stall trading shift.', false),
  ('agent.stock_request.create', 'Agent: Create stock request', 'Allow agent to request replenishment stock from vendor.', false),
  ('agent.remittance.create', 'Agent: Create remittance', 'Allow agent to submit cash remittance with POP.', true)
on conflict (key) do update
set name = excluded.name,
    description = excluded.description,
    is_approval_capable = excluded.is_approval_capable;

-- Vendor remittance review + approval
insert into public.permissions (key, name, description, is_approval_capable)
values
  ('vendor.remittance.review', 'Vendor: Review remittance', 'Allow vendor desk to view agent remittances pending POP review.', false),
  ('vendor.remittance.pop_accept', 'Vendor: Accept POP', 'Allow vendor desk to accept POP and proceed to receipt approval.', true),
  ('vendor.remittance.reject', 'Vendor: Reject POP', 'Allow vendor desk to reject POP with a reason.', false),
  ('vendor.remittance.receive_confirm', 'Vendor: Confirm receipt', 'Allow vendor desk to confirm remittance receipt (posts accounting).', true),
  ('vendor.remittance.accounting_post', 'Vendor: Post remittance accounting', 'Allow posting the accounting journal for an approved remittance receipt.', true)
on conflict (key) do update
set name = excluded.name,
    description = excluded.description,
    is_approval_capable = excluded.is_approval_capable;

commit;

