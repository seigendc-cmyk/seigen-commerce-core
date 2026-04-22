-- Authenticated tenant members may maintain their own public projection rows (publish pipeline).
-- Anonymous traffic remains read-only on published rows (previous migration).

-- ---------------------------------------------------------------------------
-- public_vendors
-- ---------------------------------------------------------------------------
create policy "public_vendors_insert_member"
  on public.public_vendors for insert to authenticated
  with check (
    tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()))
  );

create policy "public_vendors_update_member"
  on public.public_vendors for update to authenticated
  using (
    tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()))
  )
  with check (
    tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()))
  );

create policy "public_vendors_delete_member"
  on public.public_vendors for delete to authenticated
  using (
    tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- public_storefronts
-- ---------------------------------------------------------------------------
create policy "public_storefronts_insert_member"
  on public.public_storefronts for insert to authenticated
  with check (
    tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()))
  );

create policy "public_storefronts_update_member"
  on public.public_storefronts for update to authenticated
  using (
    tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()))
  )
  with check (
    tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()))
  );

create policy "public_storefronts_delete_member"
  on public.public_storefronts for delete to authenticated
  using (
    tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- public_market_listings
-- ---------------------------------------------------------------------------
create policy "public_market_listings_insert_member"
  on public.public_market_listings for insert to authenticated
  with check (
    tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()))
  );

create policy "public_market_listings_update_member"
  on public.public_market_listings for update to authenticated
  using (
    tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()))
  )
  with check (
    tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()))
  );

create policy "public_market_listings_delete_member"
  on public.public_market_listings for delete to authenticated
  using (
    tenant_id in (select tenant_id from public.tenant_members where user_id = (select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- public_listing_media (scoped via parent listing tenant)
-- ---------------------------------------------------------------------------
create policy "public_listing_media_insert_member"
  on public.public_listing_media for insert to authenticated
  with check (
    exists (
      select 1 from public.public_market_listings l
      where l.id = listing_id
        and l.tenant_id in (
          select tenant_id from public.tenant_members where user_id = (select auth.uid())
        )
    )
  );

create policy "public_listing_media_update_member"
  on public.public_listing_media for update to authenticated
  using (
    exists (
      select 1 from public.public_market_listings l
      where l.id = listing_id
        and l.tenant_id in (
          select tenant_id from public.tenant_members where user_id = (select auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1 from public.public_market_listings l
      where l.id = listing_id
        and l.tenant_id in (
          select tenant_id from public.tenant_members where user_id = (select auth.uid())
        )
    )
  );

create policy "public_listing_media_delete_member"
  on public.public_listing_media for delete to authenticated
  using (
    exists (
      select 1 from public.public_market_listings l
      where l.id = listing_id
        and l.tenant_id in (
          select tenant_id from public.tenant_members where user_id = (select auth.uid())
        )
    )
  );

-- ---------------------------------------------------------------------------
-- public_listing_regions
-- ---------------------------------------------------------------------------
create policy "public_listing_regions_insert_member"
  on public.public_listing_regions for insert to authenticated
  with check (
    exists (
      select 1 from public.public_market_listings l
      where l.id = listing_id
        and l.tenant_id in (
          select tenant_id from public.tenant_members where user_id = (select auth.uid())
        )
    )
  );

create policy "public_listing_regions_update_member"
  on public.public_listing_regions for update to authenticated
  using (
    exists (
      select 1 from public.public_market_listings l
      where l.id = listing_id
        and l.tenant_id in (
          select tenant_id from public.tenant_members where user_id = (select auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1 from public.public_market_listings l
      where l.id = listing_id
        and l.tenant_id in (
          select tenant_id from public.tenant_members where user_id = (select auth.uid())
        )
    )
  );

create policy "public_listing_regions_delete_member"
  on public.public_listing_regions for delete to authenticated
  using (
    exists (
      select 1 from public.public_market_listings l
      where l.id = listing_id
        and l.tenant_id in (
          select tenant_id from public.tenant_members where user_id = (select auth.uid())
        )
    )
  );

-- ---------------------------------------------------------------------------
-- market_listing_events — append for own tenant
-- ---------------------------------------------------------------------------
create policy "market_listing_events_insert_member"
  on public.market_listing_events for insert to authenticated
  with check (
    tenant_id is null
    or tenant_id in (
      select tenant_id from public.tenant_members where user_id = (select auth.uid())
    )
  );
