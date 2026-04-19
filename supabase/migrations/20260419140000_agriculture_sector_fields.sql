-- Align agriculture sector field_definitions with app (sale-lead oriented product form).
-- See src/modules/inventory/sector-config/sectors.ts

update public.product_sectors
set
  field_definitions =
    '[
      {"key":"agriProductType","label":"Product type","type":"select","required":true,"helpText":"Livestock, grains, or horticulture — drives how buyers filter this listing.","options":[{"value":"livestock","label":"Livestock"},{"value":"grains","label":"Grains"},{"value":"horticulture","label":"Horticulture"}]},
      {"key":"cropOrProduct","label":"Crop / product name","type":"text","required":true,"placeholder":"e.g. Maize, beef weaners, baby marrows","helpText":"Searchable name for this line (what you are selling)."},
      {"key":"varietyOrBreed","label":"Variety or breed","type":"text","placeholder":"e.g. PAN 14, Angus, Roma tomato"},
      {"key":"harvestDate","label":"Harvest / ready date","type":"date","helpText":"Expected harvest, slaughter-ready, or pack date for fresh produce."},
      {"key":"packaging","label":"Packaging","type":"select","options":[{"value":"bulk","label":"Bulk"},{"value":"bags","label":"Bags"},{"value":"crates","label":"Crates"},{"value":"punnets","label":"Punnets"},{"value":"bales","label":"Bales"},{"value":"other","label":"Other"}]},
      {"key":"packagingDetail","label":"Packaging detail","type":"text","placeholder":"e.g. 25kg bags, 4×4 kg punnets"},
      {"key":"season","label":"Season","type":"select","options":[{"value":"all","label":"All-year"},{"value":"rainy","label":"Rainy"},{"value":"dry","label":"Dry"}]},
      {"key":"pricePerUnitOffer","label":"Offer price per unit","type":"number","placeholder":"e.g. 12.50","step":"0.01","min":0,"helpText":"Asking price for this listing (sale lead). Main catalog price above should match or reflect your floor."},
      {"key":"unitForOffer","label":"Unit for offer","type":"select","options":[{"value":"kg","label":"kg"},{"value":"ton","label":"ton"},{"value":"bag","label":"bag"},{"value":"crate","label":"crate"},{"value":"head","label":"head"},{"value":"dozen","label":"dozen"},{"value":"each","label":"each"}]},
      {"key":"organicCertified","label":"Certified organic","type":"boolean"},
      {"key":"saleLeadNotes","label":"Sale lead details","type":"textarea","fullWidth":true,"rows":5,"placeholder":"MOQ, delivery radius, cold chain, grading, certifications, payment terms — anything that turns a browser into a buyer.","helpText":"Shown in search text and helps staff qualify leads."}
    ]'::jsonb,
  updated_at = now()
where id = 'agriculture';
