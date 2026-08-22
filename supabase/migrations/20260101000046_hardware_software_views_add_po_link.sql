-- v_hardware_assets/v_software_assets expand `a.*` at CREATE VIEW time --
-- adding purchase_order_id/purchase_order_item_id to `assets` via ALTER
-- TABLE (Phase 3) didn't retroactively add them to these Phase 2 views.
-- Recreate both so the asset detail page can show "Purchased Through: PO-xxx".
drop view public.v_hardware_assets;

create view public.v_hardware_assets
with (security_invoker = true)
as
select
  a.*,
  hd.brand, hd.model, hd.hostname, hd.ip_address, hd.mac_address,
  hd.warranty_start, hd.warranty_end, hd.warranty_provider, hd.warranty_reference, hd.lifecycle_years,
  (a.purchase_date + make_interval(years => hd.lifecycle_years))::date as end_of_life_date,
  case when a.purchase_date is null then null
       else ((a.purchase_date + make_interval(years => hd.lifecycle_years))::date - current_date)
  end as days_until_eol,
  case
    when a.status in ('DISPOSED', 'RETIRED', 'LOST') then a.status::text
    when a.purchase_date is null then 'ACTIVE'
    when (a.purchase_date + make_interval(years => hd.lifecycle_years))::date < current_date then 'END_OF_LIFE'
    when (a.purchase_date + make_interval(years => hd.lifecycle_years))::date - current_date <= 180 then 'NEARING_EOL'
    else 'ACTIVE'
  end as lifecycle_stage
from public.assets a
join public.hardware_details hd on hd.asset_id = a.id
where a.asset_type = 'HARDWARE';

grant select on public.v_hardware_assets to authenticated;

drop view public.v_software_assets;

create view public.v_software_assets
with (security_invoker = true)
as
select
  a.*,
  sd.software_type, sd.vendor, sd.version, sd.license_type, sd.license_key, sd.number_of_licenses,
  ss.subscription_start, ss.subscription_end, ss.renewal_date, ss.billing_cycle,
  ss.cost as subscription_cost, ss.currency as subscription_currency,
  ss.seats_total, ss.seats_used, ss.seats_available, ss.auto_renewal, ss.account_owner,
  case when ss.renewal_date is null then null else (ss.renewal_date - current_date) end as days_until_renewal
from public.assets a
join public.software_details sd on sd.asset_id = a.id
left join public.software_subscriptions ss on ss.asset_id = a.id
where a.asset_type = 'SOFTWARE';

grant select on public.v_software_assets to authenticated;
