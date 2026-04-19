-- Product sector catalog + per-tenant enabled sectors
--
-- Design (summary):
-- - product_sectors: stable string id (matches app ProductSectorId), human label, ordered field_definitions JSONB
--   Each field mirrors SectorFieldDefinition: { key, label, type, required?, placeholder?, options?, helpText? }
-- - tenant_enabled_sectors: which sectors a vendor sells in (Business Profile). Drives catalog / product form filters.
-- - Optional later: admin UI to CRUD product_sectors; ETL or app seed keeps JSON in sync with src/modules/inventory/sector-config/sectors.ts
-- - Optional later: normalize product_sector_fields into rows if you need per-field ACL or analytics.

create table if not exists public.product_sectors (
  id text primary key,
  label text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  field_definitions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_sectors_active_sort_idx
  on public.product_sectors (is_active, sort_order);

comment on table public.product_sectors is
  'Commercial sector templates; field_definitions JSON array defines product form attributes per sector.';

create table if not exists public.tenant_enabled_sectors (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  sector_id text not null references public.product_sectors (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (tenant_id, sector_id)
);

create index if not exists tenant_enabled_sectors_sector_id_idx
  on public.tenant_enabled_sectors (sector_id);

alter table public.product_sectors enable row level security;
alter table public.tenant_enabled_sectors enable row level security;

-- Catalog: readable by any signed-in user (dashboard); extend to anon if storefront reads sectors
create policy "product_sectors_select_authenticated"
  on public.product_sectors for select
  to authenticated
  using (is_active = true);

-- Tenant sector picks: members read
create policy "tenant_enabled_sectors_select_member"
  on public.tenant_enabled_sectors for select
  using (
    tenant_id in (
      select tenant_id from public.tenant_members where user_id = (select auth.uid())
    )
  );

-- Owners and admins can set which sectors apply to their tenant
create policy "tenant_enabled_sectors_insert_owner_admin"
  on public.tenant_enabled_sectors for insert
  with check (
    tenant_id in (
      select tenant_id from public.tenant_members
      where user_id = (select auth.uid()) and role in ('owner', 'admin')
    )
  );

create policy "tenant_enabled_sectors_delete_owner_admin"
  on public.tenant_enabled_sectors for delete
  using (
    tenant_id in (
      select tenant_id from public.tenant_members
      where user_id = (select auth.uid()) and role in ('owner', 'admin')
    )
  );

-- Seed from current app catalog (keep in sync with sector-config/sectors.ts when you change definitions)
insert into public.product_sectors (id, label, sort_order, field_definitions)
values
  (
    'motor_spares',
    'Motor spares',
    10,
    '[
      {"key":"vehicleMake","label":"Vehicle make","type":"text","placeholder":"e.g. Toyota"},
      {"key":"vehicleModel","label":"Vehicle model","type":"text","placeholder":"e.g. Hilux"},
      {"key":"partNumber","label":"Part number","type":"text","required":true},
      {"key":"compatibilityNotes","label":"Compatibility notes","type":"text"}
    ]'::jsonb
  ),
  (
    'clothing',
    'Clothing',
    20,
    '[
      {"key":"size","label":"Size","type":"select","options":[{"value":"XS","label":"XS"},{"value":"S","label":"S"},{"value":"M","label":"M"},{"value":"L","label":"L"},{"value":"XL","label":"XL"},{"value":"XXL","label":"XXL"}]},
      {"key":"color","label":"Color","type":"text"},
      {"key":"material","label":"Material","type":"text"},
      {"key":"gender","label":"Gender","type":"select","options":[{"value":"unisex","label":"Unisex"},{"value":"mens","label":"Men''s"},{"value":"womens","label":"Women''s"},{"value":"kids","label":"Kids"}]}
    ]'::jsonb
  ),
  (
    'pharmacy',
    'Pharmacy',
    30,
    '[
      {"key":"dosageForm","label":"Dosage form","type":"select","options":[{"value":"tablet","label":"Tablet"},{"value":"capsule","label":"Capsule"},{"value":"syrup","label":"Syrup"},{"value":"ointment","label":"Ointment"},{"value":"injection","label":"Injection"},{"value":"other","label":"Other"}]},
      {"key":"strength","label":"Strength","type":"text","placeholder":"e.g. 500mg"},
      {"key":"requiresPrescription","label":"Requires prescription","type":"boolean"},
      {"key":"activeIngredient","label":"Active ingredient","type":"text"}
    ]'::jsonb
  ),
  (
    'grocery',
    'Grocery',
    40,
    '[
      {"key":"expiryDays","label":"Expiry (days)","type":"number","placeholder":"e.g. 30"},
      {"key":"perishable","label":"Perishable","type":"boolean"},
      {"key":"originCountry","label":"Origin country","type":"text"}
    ]'::jsonb
  ),
  (
    'hardware',
    'Hardware',
    50,
    '[
      {"key":"spec","label":"Specification","type":"text","placeholder":"e.g. 10mm, galvanized"},
      {"key":"warrantyMonths","label":"Warranty (months)","type":"number"},
      {"key":"powerRating","label":"Power rating","type":"text","placeholder":"e.g. 500W"}
    ]'::jsonb
  ),
  (
    'electronics',
    'Electronics',
    60,
    '[
      {"key":"modelNumber","label":"Model number","type":"text"},
      {"key":"warrantyMonths","label":"Warranty (months)","type":"number"},
      {"key":"voltage","label":"Voltage","type":"text","placeholder":"e.g. 220V"}
    ]'::jsonb
  ),
  (
    'agriculture',
    'Agriculture',
    70,
    '[
      {"key":"cropType","label":"Crop type","type":"text"},
      {"key":"season","label":"Season","type":"select","options":[{"value":"all","label":"All-year"},{"value":"rainy","label":"Rainy"},{"value":"dry","label":"Dry"}]},
      {"key":"applicationRate","label":"Application rate","type":"text","placeholder":"e.g. 2kg/acre"}
    ]'::jsonb
  ),
  (
    'cosmetics',
    'Cosmetics',
    80,
    '[
      {"key":"skinType","label":"Skin type","type":"select","options":[{"value":"all","label":"All"},{"value":"oily","label":"Oily"},{"value":"dry","label":"Dry"},{"value":"sensitive","label":"Sensitive"}]},
      {"key":"shade","label":"Shade","type":"text"},
      {"key":"fragranceFree","label":"Fragrance-free","type":"boolean"}
    ]'::jsonb
  ),
  (
    'stationery',
    'Stationery',
    90|    100,
    '[
      {"key":"paperSize","label":"Paper size","type":"select","options":[{"value":"A4","label":"A4"},{"value":"A5","label":"A5"},{"value":"A3","label":"A3"},{"value":"letter","label":"Letter"}]},
      {"key":"pages","label":"Pages","type":"number"},
      {"key":"binding","label":"Binding","type":"select","options":[{"value":"spiral","label":"Spiral"},{"value":"glued","label":"Glued"},{"value":"stitched","label":"Stitched"},{"value":"none","label":"None"}]}
    ]'::jsonb
  ),
  (
    'general_merchandise',
    'General merchandise',
    110,
    '[
      {"key":"notes","label":"Sector notes","type":"text","placeholder":"Any extra details"}
    ]'::jsonb
  )
on conflict (id) do update set
  label = excluded.label,
  sort_order = excluded.sort_order,
  field_definitions = excluded.field_definitions,
  updated_at = now();
