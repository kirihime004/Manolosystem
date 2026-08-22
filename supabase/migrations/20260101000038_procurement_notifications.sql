-- =========================================================================
-- PHASE 3: extend the existing Phase 2 notification system (same table,
-- same idempotent dedup pattern) with procurement/budget alert types.
-- =========================================================================
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'HARDWARE_NEARING_EOL', 'HARDWARE_OVER_EOL', 'WARRANTY_EXPIRING', 'WARRANTY_EXPIRED',
  'SUBSCRIPTION_RENEWAL_DUE', 'SUBSCRIPTION_EXPIRED', 'IP_CONFLICT', 'ASSET_DEFECTIVE', 'REPAIR_OVERDUE',
  'PR_SUBMITTED', 'PR_APPROVED', 'PR_REJECTED',
  'PO_AWAITING_APPROVAL', 'PO_APPROVED', 'PO_SENT_TO_SUPPLIER',
  'DELIVERY_OVERDUE', 'DELIVERY_PARTIAL',
  'BUDGET_THRESHOLD', 'BUDGET_PERIOD_ENDING'
));

-- ---------------------------------------------------------------------
-- Configurable budget thresholds (percent-of-total warning points).
-- Defaults 75/90/100, editable per company -- never hard-coded.
-- ---------------------------------------------------------------------
create table public.budget_alert_thresholds (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  threshold_percent numeric(5, 2) not null check (threshold_percent > 0 and threshold_percent <= 200),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (company_id, threshold_percent)
);

alter table public.budget_alert_thresholds enable row level security;

create or replace function public.seed_budget_alert_thresholds()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.budget_alert_thresholds (company_id, threshold_percent) values
    (new.id, 75), (new.id, 90), (new.id, 100);
  return new;
end;
$$;

create trigger seed_budget_alert_thresholds_trigger
  after insert on public.companies
  for each row execute function public.seed_budget_alert_thresholds();

insert into public.budget_alert_thresholds (company_id, threshold_percent)
select c.id, t.pct from public.companies c cross join (values (75), (90), (100)) as t(pct)
on conflict (company_id, threshold_percent) do nothing;

-- ---------------------------------------------------------------------
-- Periodic/idempotent checks (budget thresholds, delivery overdue, budget
-- period ending). Event-driven notifications (PR submitted/approved, PO
-- sent, etc.) are inserted directly by the relevant trigger/RPC above --
-- this only covers the "crossed a line while nobody was looking" cases.
-- resource_type carries the threshold so 75/90/100 each get their own row
-- instead of colliding on the same dedup key.
-- ---------------------------------------------------------------------
create or replace function public.generate_procurement_notifications(p_company_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer := 0;
  r record;
  t record;
  v_used_pct numeric;
begin
  if not public.has_company_access(p_company_id) then
    raise exception 'Access denied';
  end if;

  for r in
    select id, budget_name, total_budget from public.budgets
    where company_id = p_company_id and status = 'ACTIVE' and total_budget > 0
  loop
    select (committed + spent) into v_used_pct from public.v_budget_summary where id = r.id;
    v_used_pct := round((v_used_pct / r.total_budget) * 100, 1);

    for t in
      select threshold_percent from public.budget_alert_thresholds
      where company_id = p_company_id and enabled
      order by threshold_percent desc
    loop
      if v_used_pct >= t.threshold_percent then
        insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
        values (p_company_id, 'BUDGET_THRESHOLD',
          case when t.threshold_percent >= 100 then 'Budget exhausted' else 'Budget usage at ' || t.threshold_percent || '%' end,
          r.budget_name || ' has used ' || v_used_pct || '% of its total budget.',
          'budget_' || t.threshold_percent::text, r.id)
        on conflict (company_id, type, resource_type, resource_id) do nothing;
        if found then v_count := v_count + 1; end if;
        exit; -- only the highest threshold crossed needs to fire per run
      end if;
    end loop;
  end loop;

  for r in
    select id, budget_name, end_date from public.budgets
    where company_id = p_company_id and status = 'ACTIVE'
      and end_date - current_date <= 30 and end_date >= current_date
  loop
    insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
    values (p_company_id, 'BUDGET_PERIOD_ENDING', 'Budget period ending soon',
      r.budget_name || ' ends on ' || to_char(r.end_date, 'DD Mon YYYY') || '.', 'budget', r.id)
    on conflict (company_id, type, resource_type, resource_id) do nothing;
    if found then v_count := v_count + 1; end if;
  end loop;

  for r in
    select po.id, po.po_number, po.expected_delivery_date from public.purchase_orders po
    where po.company_id = p_company_id
      and po.status in ('SENT_TO_SUPPLIER', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED')
      and po.expected_delivery_date is not null
      and po.expected_delivery_date < current_date
  loop
    insert into public.notifications (company_id, type, title, message, resource_type, resource_id)
    values (p_company_id, 'DELIVERY_OVERDUE', 'Delivery overdue',
      r.po_number || ' was expected ' || to_char(r.expected_delivery_date, 'DD Mon YYYY') || '.', 'purchase_order', r.id)
    on conflict (company_id, type, resource_type, resource_id) do nothing;
    if found then v_count := v_count + 1; end if;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.generate_procurement_notifications(uuid) to authenticated;
