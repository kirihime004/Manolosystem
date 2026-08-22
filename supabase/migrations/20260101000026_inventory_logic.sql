-- =========================================================================
-- PHASE 2: asset lifecycle logic -- history logging, lifecycle views,
-- repair/disposal workflows, IP conflict detection, notification generator.
-- =========================================================================

-- ---------------------------------------------------------------------
-- assets: insert / update triggers
-- ---------------------------------------------------------------------
create or replace function public.before_insert_asset()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.asset_code := public.generate_asset_code(
    new.company_id,
    case new.asset_type when 'HARDWARE' then 'HW' when 'SOFTWARE' then 'SW' end
  );
  new.created_by := auth.uid();
  if new.assigned_to is not null and new.status = 'UNASSIGNED' then
    new.status := 'ACTIVE';
  end if;
  return new;
end;
$$;

create trigger before_insert_asset_trigger
  before insert on public.assets
  for each row execute function public.before_insert_asset();

create or replace function public.after_insert_asset()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.asset_history (company_id, asset_id, event_type, performed_by, new_value)
  values (new.company_id, new.id, 'CREATED', auth.uid(),
    jsonb_build_object('asset_code', new.asset_code, 'name', new.name, 'asset_type', new.asset_type));

  if new.assigned_to is not null then
    insert into public.asset_history (company_id, asset_id, event_type, performed_by, new_value)
    values (new.company_id, new.id, 'ASSIGNED', auth.uid(), jsonb_build_object('assigned_to', new.assigned_to));
  end if;

  perform public.log_audit_event(new.company_id, 'ASSET_CREATED', 'asset', new.id,
    jsonb_build_object('asset_code', new.asset_code, 'asset_type', new.asset_type));
  return new;
end;
$$;

create trigger after_insert_asset_trigger
  after insert on public.assets
  for each row execute function public.after_insert_asset();

-- Column-level permission enforcement, mirroring before_update_ticket():
-- narrower permissions (ASSIGN, DISPOSE, REPAIR) unlock only their own
-- column group; everything else needs the general UPDATE permission.
create or replace function public.before_update_asset()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.company_id <> old.company_id then
    raise exception 'company_id cannot be changed';
  end if;
  if new.asset_type <> old.asset_type then
    raise exception 'asset_type cannot be changed';
  end if;
  if new.asset_code <> old.asset_code then
    raise exception 'asset_code cannot be changed';
  end if;

  if (new.assigned_to, new.department_id, new.location) is distinct from (old.assigned_to, old.department_id, old.location)
     and not public.has_permission(old.company_id, 'IT.INVENTORY.ASSIGN')
     and not public.has_permission(old.company_id, 'IT.INVENTORY.UPDATE') then
    raise exception 'Missing permission IT.INVENTORY.ASSIGN';
  end if;

  if new.status is distinct from old.status then
    if new.status = 'DISPOSED' and not public.has_permission(old.company_id, 'IT.INVENTORY.DISPOSE') then
      raise exception 'Missing permission IT.INVENTORY.DISPOSE';
    end if;
    if new.status = 'REPAIR'
       and not public.has_permission(old.company_id, 'IT.INVENTORY.REPAIR')
       and not public.has_permission(old.company_id, 'IT.INVENTORY.UPDATE') then
      raise exception 'Missing permission IT.INVENTORY.REPAIR';
    end if;
    if new.status not in ('DISPOSED', 'REPAIR') and not public.has_permission(old.company_id, 'IT.INVENTORY.UPDATE') then
      raise exception 'Missing permission IT.INVENTORY.UPDATE';
    end if;
  end if;

  if (new.name, new.category, new.condition, new.serial_number, new.asset_tag, new.purchase_date,
      new.purchase_price, new.currency, new.supplier_id, new.invoice_number, new.purchase_order, new.notes)
     is distinct from
     (old.name, old.category, old.condition, old.serial_number, old.asset_tag, old.purchase_date,
      old.purchase_price, old.currency, old.supplier_id, old.invoice_number, old.purchase_order, old.notes)
     and not public.has_permission(old.company_id, 'IT.INVENTORY.UPDATE') then
    raise exception 'Missing permission IT.INVENTORY.UPDATE';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger before_update_asset_trigger
  before update on public.assets
  for each row execute function public.before_update_asset();

-- Every meaningful field change gets its own asset_history row. `reason`
-- is picked up from an optional session-local setting (app.change_reason)
-- so RPCs like reassign_asset()/mark_asset_defective() can attach a reason
-- without this trigger needing extra parameters.
create or replace function public.after_update_asset()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reason text;
begin
  v_reason := nullif(current_setting('app.change_reason', true), '');

  if new.assigned_to is distinct from old.assigned_to then
    insert into public.asset_history (company_id, asset_id, event_type, performed_by, previous_value, new_value, reason)
    values (
      new.company_id, new.id,
      case when old.assigned_to is null then 'ASSIGNED' when new.assigned_to is null then 'UNASSIGNED' else 'REASSIGNED' end,
      auth.uid(), jsonb_build_object('assigned_to', old.assigned_to), jsonb_build_object('assigned_to', new.assigned_to), v_reason
    );
    perform public.log_audit_event(new.company_id, 'ASSET_REASSIGNED', 'asset', new.id,
      jsonb_build_object('asset_code', new.asset_code, 'assigned_to', new.assigned_to));
  end if;

  if new.department_id is distinct from old.department_id then
    insert into public.asset_history (company_id, asset_id, event_type, performed_by, previous_value, new_value, reason)
    values (new.company_id, new.id, 'DEPARTMENT_CHANGED', auth.uid(),
      jsonb_build_object('department_id', old.department_id), jsonb_build_object('department_id', new.department_id), v_reason);
  end if;

  if new.location is distinct from old.location then
    insert into public.asset_history (company_id, asset_id, event_type, performed_by, previous_value, new_value, reason)
    values (new.company_id, new.id, 'LOCATION_CHANGED', auth.uid(),
      jsonb_build_object('location', old.location), jsonb_build_object('location', new.location), v_reason);
  end if;

  if new.status is distinct from old.status then
    insert into public.asset_history (company_id, asset_id, event_type, performed_by, previous_value, new_value, reason)
    values (new.company_id, new.id, 'STATUS_CHANGED', auth.uid(),
      jsonb_build_object('status', old.status), jsonb_build_object('status', new.status), v_reason);

    perform public.log_audit_event(new.company_id, 'ASSET_STATUS_CHANGED', 'asset', new.id,
      jsonb_build_object('asset_code', new.asset_code, 'old_status', old.status, 'new_status', new.status));
  end if;

  if new.condition is distinct from old.condition then
    insert into public.asset_history (company_id, asset_id, event_type, performed_by, previous_value, new_value, reason)
    values (new.company_id, new.id, 'CONDITION_CHANGED', auth.uid(),
      jsonb_build_object('condition', old.condition), jsonb_build_object('condition', new.condition), v_reason);
  end if;

  if (new.purchase_date, new.purchase_price, new.currency) is distinct from (old.purchase_date, old.purchase_price, old.currency) then
    insert into public.asset_history (company_id, asset_id, event_type, performed_by, previous_value, new_value)
    values (new.company_id, new.id, 'PURCHASE_UPDATED', auth.uid(),
      jsonb_build_object('purchase_date', old.purchase_date, 'purchase_price', old.purchase_price, 'currency', old.currency),
      jsonb_build_object('purchase_date', new.purchase_date, 'purchase_price', new.purchase_price, 'currency', new.currency));
  end if;

  perform set_config('app.change_reason', '', true);
  return new;
end;
$$;

create trigger after_update_asset_trigger
  after update on public.assets
  for each row execute function public.after_update_asset();

-- ---------------------------------------------------------------------
-- hardware_details / software_details / software_subscriptions:
-- derive company_id from the parent asset, validate asset_type match.
-- ---------------------------------------------------------------------
create or replace function public.derive_hardware_details_company_id()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_company_id uuid;
  v_type public.asset_type;
begin
  select company_id, asset_type into v_company_id, v_type from public.assets where id = new.asset_id;
  if v_company_id is null then raise exception 'Invalid asset_id'; end if;
  if v_type <> 'HARDWARE' then raise exception 'asset_id must reference a HARDWARE asset'; end if;
  new.company_id := v_company_id;
  return new;
end;
$$;

create trigger derive_hardware_details_company_id_trigger
  before insert on public.hardware_details
  for each row execute function public.derive_hardware_details_company_id();

create or replace function public.derive_software_details_company_id()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_company_id uuid;
  v_type public.asset_type;
begin
  select company_id, asset_type into v_company_id, v_type from public.assets where id = new.asset_id;
  if v_company_id is null then raise exception 'Invalid asset_id'; end if;
  if v_type <> 'SOFTWARE' then raise exception 'asset_id must reference a SOFTWARE asset'; end if;
  new.company_id := v_company_id;
  return new;
end;
$$;

create trigger derive_software_details_company_id_trigger
  before insert on public.software_details
  for each row execute function public.derive_software_details_company_id();

create or replace function public.derive_software_subscription_company_id()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_company_id uuid;
  v_software_type text;
begin
  select a.company_id, sd.software_type into v_company_id, v_software_type
  from public.assets a
  join public.software_details sd on sd.asset_id = a.id
  where a.id = new.asset_id;
  if v_company_id is null then raise exception 'Invalid asset_id'; end if;
  if v_software_type <> 'SUBSCRIPTION' then raise exception 'asset must have software_type SUBSCRIPTION'; end if;
  new.company_id := v_company_id;
  return new;
end;
$$;

create trigger derive_software_subscription_company_id_trigger
  before insert on public.software_subscriptions
  for each row execute function public.derive_software_subscription_company_id();

-- ---------------------------------------------------------------------
-- Lifecycle views. security_invoker=true means these run with the
-- QUERYING user's own RLS, never the view owner's -- they add zero extra
-- privilege, they only compute derived columns over data the caller could
-- already see directly.
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- Assignment workflow RPC -- the intended write path from the UI so a
-- reassignment reason gets captured; a plain UPDATE still works (and is
-- still fully logged by after_update_asset) but without a reason.
-- ---------------------------------------------------------------------
create or replace function public.reassign_asset(
  p_asset_id uuid,
  p_assigned_to uuid,
  p_department_id uuid,
  p_location text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_status public.asset_status;
begin
  select company_id, status into v_company_id, v_status from public.assets where id = p_asset_id;
  if v_company_id is null then
    raise exception 'Asset not found';
  end if;
  if not public.has_permission(v_company_id, 'IT.INVENTORY.ASSIGN') then
    raise exception 'Missing permission IT.INVENTORY.ASSIGN';
  end if;

  perform set_config('app.change_reason', coalesce(p_reason, ''), true);

  update public.assets
  set assigned_to = p_assigned_to,
      department_id = p_department_id,
      location = p_location,
      status = case
        when p_assigned_to is not null and v_status = 'UNASSIGNED' then 'ACTIVE'::public.asset_status
        when p_assigned_to is null and v_status = 'ACTIVE' then 'UNASSIGNED'::public.asset_status
        else v_status
      end
  where id = p_asset_id;
end;
$$;

grant execute on function public.reassign_asset(uuid, uuid, uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Mark-defective workflow RPC.
-- ---------------------------------------------------------------------
create or replace function public.mark_asset_defective(
  p_asset_id uuid,
  p_reason text,
  p_description text,
  p_recommended_action text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
begin
  if p_recommended_action not in ('REPAIR', 'REPLACE', 'DISPOSE', 'ASSESS') then
    raise exception 'Invalid recommended_action';
  end if;

  select company_id into v_company_id from public.assets where id = p_asset_id;
  if v_company_id is null then
    raise exception 'Asset not found';
  end if;
  if not public.has_permission(v_company_id, 'IT.INVENTORY.UPDATE') then
    raise exception 'Missing permission IT.INVENTORY.UPDATE';
  end if;

  perform set_config('app.change_reason', coalesce(p_reason, ''), true);

  update public.assets set status = 'DEFECTIVE', condition = 'DEFECTIVE' where id = p_asset_id;

  insert into public.asset_history (company_id, asset_id, event_type, performed_by, new_value, reason, notes)
  values (v_company_id, p_asset_id, 'MARKED_DEFECTIVE', auth.uid(),
    jsonb_build_object('recommended_action', p_recommended_action), p_reason, p_description);

  insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
  values (v_company_id, 'ASSET_DEFECTIVE', 'Asset marked defective',
    coalesce(p_description, 'An asset was marked defective and needs review.'), 'asset', p_asset_id)
  on conflict (company_id, type, resource_type, resource_id) do nothing;

  perform public.log_audit_event(v_company_id, 'ASSET_MARKED_DEFECTIVE', 'asset', p_asset_id,
    jsonb_build_object('recommended_action', p_recommended_action));
end;
$$;

grant execute on function public.mark_asset_defective(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- Repairs workflow
-- ---------------------------------------------------------------------
create or replace function public.derive_repair_company_id()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id from public.assets where id = new.asset_id;
  if v_company_id is null then raise exception 'Invalid asset_id'; end if;
  new.company_id := v_company_id;
  if new.reported_by is null then new.reported_by := auth.uid(); end if;
  return new;
end;
$$;

create trigger derive_repair_company_id_trigger
  before insert on public.repairs
  for each row execute function public.derive_repair_company_id();

create or replace function public.after_insert_repair()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.assets set status = 'REPAIR' where id = new.asset_id and status <> 'REPAIR';

  insert into public.asset_history (company_id, asset_id, event_type, performed_by, new_value, notes)
  values (new.company_id, new.asset_id, 'REPAIR_STARTED', auth.uid(),
    jsonb_build_object('repair_id', new.id, 'repair_status', new.repair_status), new.problem_description);

  perform public.log_audit_event(new.company_id, 'ASSET_REPAIR_CREATED', 'repair', new.id,
    jsonb_build_object('asset_id', new.asset_id));
  return new;
end;
$$;

create trigger after_insert_repair_trigger
  after insert on public.repairs
  for each row execute function public.after_insert_repair();

create or replace function public.before_update_repair()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.repair_status = 'COMPLETED' and old.repair_status <> 'COMPLETED' and new.actual_completion_date is null then
    new.actual_completion_date := current_date;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger before_update_repair_trigger
  before update on public.repairs
  for each row execute function public.before_update_repair();

create or replace function public.after_update_repair()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.repair_status is distinct from old.repair_status then
    if new.repair_status = 'COMPLETED' then
      update public.assets set status = 'ACTIVE' where id = new.asset_id and status = 'REPAIR';

      insert into public.asset_history (company_id, asset_id, event_type, performed_by, new_value, notes)
      values (new.company_id, new.asset_id, 'REPAIR_COMPLETED', auth.uid(),
        jsonb_build_object('repair_id', new.id, 'repair_cost', new.repair_cost), new.notes);

      perform public.log_audit_event(new.company_id, 'ASSET_REPAIR_COMPLETED', 'repair', new.id,
        jsonb_build_object('asset_id', new.asset_id));
    elsif new.repair_status = 'CANCELLED' then
      update public.assets set status = 'ACTIVE' where id = new.asset_id and status = 'REPAIR';
    end if;
  end if;
  return new;
end;
$$;

create trigger after_update_repair_trigger
  after update on public.repairs
  for each row execute function public.after_update_repair();

-- ---------------------------------------------------------------------
-- Disposal workflow
-- ---------------------------------------------------------------------
create or replace function public.derive_disposal_company_id()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_company_id uuid;
begin
  select company_id into v_company_id from public.assets where id = new.asset_id;
  if v_company_id is null then raise exception 'Invalid asset_id'; end if;
  new.company_id := v_company_id;
  if new.disposed_by is null then new.disposed_by := auth.uid(); end if;
  return new;
end;
$$;

create trigger derive_disposal_company_id_trigger
  before insert on public.disposals
  for each row execute function public.derive_disposal_company_id();

create or replace function public.after_insert_disposal()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.assets set status = 'DISPOSED' where id = new.asset_id;

  insert into public.asset_history (company_id, asset_id, event_type, performed_by, new_value, reason, notes)
  values (new.company_id, new.asset_id, 'DISPOSED', auth.uid(),
    jsonb_build_object('disposal_id', new.id, 'disposal_method', new.disposal_method), new.disposal_reason, new.notes);

  perform public.log_audit_event(new.company_id, 'ASSET_DISPOSED', 'disposal', new.id,
    jsonb_build_object('asset_id', new.asset_id));
  return new;
end;
$$;

create trigger after_insert_disposal_trigger
  after insert on public.disposals
  for each row execute function public.after_insert_disposal();

-- ---------------------------------------------------------------------
-- IP conflict detection. Never overwrites the existing record -- both the
-- new and the pre-existing row are flagged CONFLICT and a notification is
-- raised, leaving a human to resolve which one is correct.
-- ---------------------------------------------------------------------
create or replace function public.check_ip_conflict()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_conflict_id uuid;
begin
  if new.status in ('ACTIVE', 'RESERVED') then
    select id into v_conflict_id
    from public.ip_addresses
    where company_id = new.company_id
      and ip_address = new.ip_address
      and status in ('ACTIVE', 'RESERVED')
      and id <> new.id
    limit 1;

    if v_conflict_id is not null then
      new.status := 'CONFLICT';
      update public.ip_addresses set status = 'CONFLICT' where id = v_conflict_id and status <> 'CONFLICT';

      insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
      values (new.company_id, 'IP_CONFLICT', 'IP address conflict detected',
        host(new.ip_address) || ' is already in use by another active record.', 'ip_address', v_conflict_id)
      on conflict (company_id, type, resource_type, resource_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;

create trigger check_ip_conflict_trigger
  before insert or update on public.ip_addresses
  for each row execute function public.check_ip_conflict();

-- ---------------------------------------------------------------------
-- Notification generator. Idempotent: relies on the notifications table's
-- unique(company_id, type, resource_type, resource_id) + ON CONFLICT DO
-- NOTHING, so calling this repeatedly (e.g. from a daily schedule) never
-- creates duplicate rows for the same underlying condition.
-- ---------------------------------------------------------------------
create or replace function public.generate_inventory_notifications(p_company_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer := 0;
  r record;
begin
  if not public.has_company_access(p_company_id) then
    raise exception 'Access denied';
  end if;

  -- Hardware lifecycle
  for r in
    select a.id, a.asset_code, a.name,
           (a.purchase_date + make_interval(years => hd.lifecycle_years))::date as eol
    from public.assets a
    join public.hardware_details hd on hd.asset_id = a.id
    where a.company_id = p_company_id
      and a.status not in ('DISPOSED', 'RETIRED', 'LOST')
      and a.purchase_date is not null
  loop
    if r.eol < current_date then
      insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
      values (p_company_id, 'HARDWARE_OVER_EOL', 'Over 5 years — replacement review required',
        r.asset_code || ' (' || r.name || ') passed its end-of-life date on ' || to_char(r.eol, 'DD Mon YYYY') || '.',
        'asset', r.id)
      on conflict (company_id, type, resource_type, resource_id) do nothing;
      if found then v_count := v_count + 1; end if;
    elsif r.eol - current_date <= 180 then
      insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
      values (p_company_id, 'HARDWARE_NEARING_EOL', 'Nearing end of life',
        r.asset_code || ' (' || r.name || ') reaches end-of-life on ' || to_char(r.eol, 'DD Mon YYYY') || '.',
        'asset', r.id)
      on conflict (company_id, type, resource_type, resource_id) do nothing;
      if found then v_count := v_count + 1; end if;
    end if;
  end loop;

  -- Warranty
  for r in
    select a.id, a.asset_code, a.name, hd.warranty_end
    from public.assets a
    join public.hardware_details hd on hd.asset_id = a.id
    where a.company_id = p_company_id
      and a.status not in ('DISPOSED', 'RETIRED', 'LOST')
      and hd.warranty_end is not null
  loop
    if r.warranty_end < current_date then
      insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
      values (p_company_id, 'WARRANTY_EXPIRED', 'Warranty expired',
        r.asset_code || ' (' || r.name || ') warranty expired on ' || to_char(r.warranty_end, 'DD Mon YYYY') || '.',
        'asset', r.id)
      on conflict (company_id, type, resource_type, resource_id) do nothing;
      if found then v_count := v_count + 1; end if;
    elsif r.warranty_end - current_date <= 30 then
      insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
      values (p_company_id, 'WARRANTY_EXPIRING', 'Warranty expiring soon',
        r.asset_code || ' (' || r.name || ') warranty expires on ' || to_char(r.warranty_end, 'DD Mon YYYY') || '.',
        'asset', r.id)
      on conflict (company_id, type, resource_type, resource_id) do nothing;
      if found then v_count := v_count + 1; end if;
    end if;
  end loop;

  -- Software subscription renewals
  for r in
    select a.id, a.asset_code, a.name, ss.renewal_date
    from public.assets a
    join public.software_details sd on sd.asset_id = a.id
    join public.software_subscriptions ss on ss.asset_id = a.id
    where a.company_id = p_company_id
      and sd.software_type = 'SUBSCRIPTION'
      and a.status not in ('CANCELLED', 'EXPIRED', 'RETIRED', 'DISPOSED')
      and ss.renewal_date is not null
  loop
    if r.renewal_date < current_date then
      insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
      values (p_company_id, 'SUBSCRIPTION_EXPIRED', 'Subscription expired',
        r.asset_code || ' (' || r.name || ') renewal date passed on ' || to_char(r.renewal_date, 'DD Mon YYYY') || '.',
        'asset', r.id)
      on conflict (company_id, type, resource_type, resource_id) do nothing;
      if found then v_count := v_count + 1; end if;
    elsif r.renewal_date - current_date <= 90 then
      insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
      values (p_company_id, 'SUBSCRIPTION_RENEWAL_DUE',
        'Renewal in ' || (r.renewal_date - current_date) || ' days',
        r.asset_code || ' (' || r.name || ') renews on ' || to_char(r.renewal_date, 'DD Mon YYYY') || '.',
        'asset', r.id)
      on conflict (company_id, type, resource_type, resource_id) do nothing;
      if found then v_count := v_count + 1; end if;
    end if;
  end loop;

  -- Overdue repairs
  for r in
    select rep.id, a.asset_code, a.name, rep.expected_completion_date
    from public.repairs rep
    join public.assets a on a.id = rep.asset_id
    where rep.company_id = p_company_id
      and rep.repair_status in ('REQUESTED', 'IN_REPAIR', 'WAITING_FOR_PARTS')
      and rep.expected_completion_date is not null
      and rep.expected_completion_date < current_date
  loop
    insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
    values (p_company_id, 'REPAIR_OVERDUE', 'Repair overdue',
      r.asset_code || ' (' || r.name || ') repair was expected ' || to_char(r.expected_completion_date, 'DD Mon YYYY') || '.',
      'repair', r.id)
    on conflict (company_id, type, resource_type, resource_id) do nothing;
    if found then v_count := v_count + 1; end if;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.generate_inventory_notifications(uuid) to authenticated;
