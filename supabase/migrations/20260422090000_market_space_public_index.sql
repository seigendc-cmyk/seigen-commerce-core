-- Market Space + iTred: public-safe projection layer (Phase 1).
-- Source of truth remains internal vendor/product/stock/price tables; this is a derived denormalized index.
-- Public apps and iTred read ONLY these projections (+ controlled APIs), never raw operational product rows.

-- ---------------------------------------------------------------------------
-- Publish lifecycle (strict)
-- ---------------------------------------------------------------------------
create type public.market_listing_publish_status as enum (
  'draft',
  'pending_review',
  'publish_ready',
  'published',
  'suspended',
  'hidden_out_of_stock',
  'archived',
  'rejected'
);

-- ---------------------------------------------------------------------------
-- public_vendors — safe vendor identity for discovery
-- ---------------------------------------------------------------------------
create table if not exists public.public_vendors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  vendor_id text not null,
  business_name text not null,
  public_slug text not null,
  logo_url text,
  hero_image_url text,
  short_description text,
  verified_badge boolean not null default false,
  trust_score numeric(12, 4),
  primary_category text,
  country text,
  province text,
  city text,
  suburb text,
  storefront_id text not null,
  storefront_slug text not null,
  active boolean not null default true,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (tenant_id, vendor_id),
  unique (public_slug)
);

create index if not exists public_vendors_tenant_active_idx
  on public.public_vendors (tenant_id, active) where active = true;
create index if not exists public_vendors_geo_idx
  on public.public_vendors (country, province, city);
create index if not exists public_vendors_storefront_slug_idx
  on public.public_vendors (storefront_slug);

-- ---------------------------------------------------------------------------
-- public_storefronts — routing registry for storefront handoff
-- ---------------------------------------------------------------------------
create table if not exists public.public_storefronts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  vendor_id text not null,
  storefront_id text not null,
  storefront_slug text not null,
  storefront_title text not null,
  primary_branch_id text,
  default_country text,
  default_city text,
  public_status text not null default 'active',
  contact_whatsapp text,
  contact_phone text,
  pickup_enabled boolean not null default false,
  delivery_enabled boolean not null default false,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (tenant_id, storefront_id),
  unique (storefront_slug)
);

create index if not exists public_storefronts_tenant_active_idx
  on public.public_storefronts (tenant_id, active) where active = true;

-- ---------------------------------------------------------------------------
-- public_market_listings — single index for Market Space + iTred
-- ---------------------------------------------------------------------------
create table if not exists public.public_market_listings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  vendor_id text not null,
  branch_id text not null,
  storefront_id text not null,
  product_id text not null,
  sku text,
  listing_slug text not null,
  title text not null,
  short_description text,
  brand text,
  category_id text,
  category_name text,
  searchable_text text,
  public_price numeric(18, 4) not null,
  compare_at_price numeric(18, 4),
  currency_code text not null default 'USD',
  stock_badge text,
  stock_signal text,
  hero_image_url text,
  image_count integer not null default 0,
  verification_flag boolean not null default false,
  trust_score numeric(12, 4),
  freshness_score numeric(12, 4),
  ranking_score numeric(12, 4),
  publish_status public.market_listing_publish_status not null default 'draft',
  city text,
  suburb text,
  province text,
  country text,
  lat numeric(12, 8),
  lng numeric(12, 8),
  radius_km numeric(12, 4),
  same_city_priority boolean not null default false,
  same_suburb_priority boolean not null default false,
  cross_border_allowed boolean not null default false,
  pickup_supported boolean not null default false,
  delivery_supported boolean not null default false,
  visible_in_market_space boolean not null default false,
  visible_in_itred boolean not null default false,
  published_at timestamptz,
  refreshed_at timestamptz not null default now(),
  unique (tenant_id, product_id, branch_id),
  unique (listing_slug)
);

create index if not exists public_market_listings_published_ms_idx
  on public.public_market_listings (publish_status, visible_in_market_space)
  where publish_status = 'published' and visible_in_market_space = true;
create index if not exists public_market_listings_published_itred_idx
  on public.public_market_listings (publish_status, visible_in_itred)
  where publish_status = 'published' and visible_in_itred = true;
create index if not exists public_market_listings_geo_idx
  on public.public_market_listings (country, province, city, suburb);
create index if not exists public_market_listings_lat_lng_idx
  on public.public_market_listings (lat, lng)
  where lat is not null and lng is not null;
create index if not exists public_market_listings_category_idx
  on public.public_market_listings (category_id);
create index if not exists public_market_listings_vendor_idx
  on public.public_market_listings (vendor_id);
create index if not exists public_market_listings_searchable_fts_idx
  on public.public_market_listings using gin (to_tsvector('simple', coalesce(searchable_text, '')));

-- ---------------------------------------------------------------------------
-- public_listing_media
-- ---------------------------------------------------------------------------
create table if not exists public.public_listing_media (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.public_market_listings (id) on delete cascade,
  image_url text not null,
  sort_order integer not null default 0,
  alt_text text,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists public_listing_media_listing_idx
  on public.public_listing_media (listing_id, sort_order);

-- ---------------------------------------------------------------------------
-- public_listing_regions — multi-region / radius overlays
-- ---------------------------------------------------------------------------
create table if not exists public.public_listing_regions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.public_market_listings (id) on delete cascade,
  country text,
  province text,
  city text,
  suburb text,
  lat numeric(12, 8),
  lng numeric(12, 8),
  radius_km numeric(12, 4),
  delivery_supported boolean not null default false,
  pickup_supported boolean not null default false
);

create index if not exists public_listing_regions_listing_idx
  on public.public_listing_regions (listing_id);
create index if not exists public_listing_regions_geo_idx
  on public.public_listing_regions (country, province, city);

-- ---------------------------------------------------------------------------
-- market_listing_events — append-only projection + publish audit feed
-- ---------------------------------------------------------------------------
create table if not exists public.market_listing_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants (id) on delete set null,
  vendor_id text,
  listing_id uuid references public.public_market_listings (id) on delete set null,
  event_type text not null,
  actor_id uuid,
  actor_type text not null default 'system' check (actor_type in ('user', 'system', 'integration')),
  source_module text not null default 'market_space',
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists market_listing_events_occurred_idx
  on public.market_listing_events (occurred_at desc);
create index if not exists market_listing_events_listing_idx
  on public.market_listing_events (listing_id, occurred_at desc);
create index if not exists market_listing_events_type_idx
  on public.market_listing_events (event_type);

comment on table public.public_vendors is 'Public-safe vendor summary for Market Space / iTred; not authoritative.';
comment on table public.public_storefronts is 'Public storefront routing; handoff target from discovery.';
comment on table public.public_market_listings is 'Single denormalized listing index for Market Space + iTred search.';
comment on table public.market_listing_events is 'Append-only publish/search/projection audit trail for listings.';

-- ---------------------------------------------------------------------------
-- RLS: anonymous read of published, active projections only (tune per env).
-- Writes go through service role / trusted workers only.
-- ---------------------------------------------------------------------------
alter table public.public_vendors enable row level security;
alter table public.public_storefronts enable row level security;
alter table public.public_market_listings enable row level security;
alter table public.public_listing_media enable row level security;
alter table public.public_listing_regions enable row level security;
alter table public.market_listing_events enable row level security;

create policy "public_vendors_select_active_anon"
  on public.public_vendors for select to anon
  using (active = true);

create policy "public_storefronts_select_active_anon"
  on public.public_storefronts for select to anon
  using (active = true and public_status = 'active');

create policy "public_market_listings_select_published_anon"
  on public.public_market_listings for select to anon
  using (
    publish_status = 'published'
    and (visible_in_market_space = true or visible_in_itred = true)
  );

create policy "public_listing_media_select_anon"
  on public.public_listing_media for select to anon
  using (
    exists (
      select 1 from public.public_market_listings l
      where l.id = listing_id
        and l.publish_status = 'published'
        and (l.visible_in_market_space = true or l.visible_in_itred = true)
    )
  );

create policy "public_listing_regions_select_anon"
  on public.public_listing_regions for select to anon
  using (
    exists (
      select 1 from public.public_market_listings l
      where l.id = listing_id
        and l.publish_status = 'published'
        and (l.visible_in_market_space = true or l.visible_in_itred = true)
    )
  );

-- No anon insert/update on projection tables; service role bypasses RLS.
-- Authenticated tenant members: optional later policies for preview/drafts.

create policy "market_listing_events_select_tenant_member"
  on public.market_listing_events for select to authenticated
  using (
    tenant_id is null
    or tenant_id in (
      select tenant_id from public.tenant_members where user_id = (select auth.uid())
    )
  );
