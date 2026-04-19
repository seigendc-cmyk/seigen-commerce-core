-- Align billing_plan_catalog + tenant_subscriptions with seiGEN infrastructure pricing narrative.
-- Run after 20260419180000_billing_plans_invoices.sql

-- Point existing workspaces at canonical tier ids
update public.tenant_subscriptions
set plan_id = 'business'
where plan_id in ('commerce-plus', 'multi-branch-retail');

update public.tenant_subscriptions
set plan_id = 'scale'
where plan_id = 'distributor';

-- Replace catalog rows (amounts in USD cents; enterprise = 0 = negotiate)
insert into public.billing_plan_catalog (plan_id, display_name, monthly_amount_cents, currency, sort_order)
values
  ('free', 'Free', 0, 'USD', 10),
  ('starter', 'Starter', 400, 'USD', 20),
  ('lite-shop', 'Lite Shop', 600, 'USD', 30),
  ('growth-pos', 'Growth POS', 1800, 'USD', 40),
  ('growth-plus', 'Growth Plus', 3000, 'USD', 50),
  ('business', 'Business', 4500, 'USD', 60),
  ('scale', 'Scale', 7500, 'USD', 70),
  ('enterprise', 'Enterprise', 0, 'USD', 80)
on conflict (plan_id) do update set
  display_name = excluded.display_name,
  monthly_amount_cents = excluded.monthly_amount_cents,
  sort_order = excluded.sort_order,
  updated_at = now();

delete from public.billing_plan_catalog
where plan_id in ('commerce-plus', 'multi-branch-retail', 'distributor');
