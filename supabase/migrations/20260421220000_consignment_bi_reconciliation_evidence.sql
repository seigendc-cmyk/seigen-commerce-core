-- Consignment BI: reconciliation metadata, document links, extended document types (industrial evidence layer)

begin;

alter table public.consignment_reconciliations
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.consignment_documents drop constraint if exists consignment_documents_document_type_check;
alter table public.consignment_documents add constraint consignment_documents_document_type_check check (
  document_type in (
    'agreement_contract',
    'issue_invoice',
    'issue_note',
    'goods_receipt',
    'return_note',
    'damage_report',
    'missing_report',
    'settlement_statement',
    'proof_of_payment',
    'reconciliation_sheet',
    'evidence_bundle',
    'export_package'
  )
);

create table if not exists public.consignment_document_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  document_id uuid not null references public.consignment_documents (id) on delete cascade,
  link_kind text not null default 'supporting' check (link_kind in ('primary', 'supporting', 'evidence', 'counterparty_copy')),
  target_type text not null check (
    target_type in ('movement', 'settlement', 'reconciliation', 'consignment_item', 'consignment', 'agreement', 'external_party')
  ),
  target_id text not null,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists consignment_document_links_doc_idx on public.consignment_document_links (tenant_id, document_id);
create index if not exists consignment_document_links_target_idx on public.consignment_document_links (tenant_id, target_type, target_id);

alter table public.consignment_document_links enable row level security;

do $$
begin
  execute 'drop policy if exists consignment_document_links_select_member on public.consignment_document_links';
  execute 'create policy consignment_document_links_select_member on public.consignment_document_links for select to authenticated using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid())))';
  execute 'drop policy if exists consignment_document_links_write_admin on public.consignment_document_links';
  execute 'create policy consignment_document_links_write_admin on public.consignment_document_links for all to authenticated using (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in (''owner'',''admin''))) with check (tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()) and role in (''owner'',''admin'')))';
end $$;

commit;
