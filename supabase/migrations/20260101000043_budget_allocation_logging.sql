-- budget_transactions has no client-facing write policy (only SECURITY
-- DEFINER functions post to it) -- but budget_allocations IS directly
-- writable by permission holders, so an allocation needs its own
-- auto-logging trigger rather than requiring the client to separately
-- call an RPC. adjustment_sign lets an allocation *decrease* be recorded
-- too (previously the view only ever summed ALLOCATION as a positive
-- contributor).
create or replace view public.v_budget_summary
with (security_invoker = true)
as
select
  b.*,
  coalesce(sum(t.amount * t.adjustment_sign) filter (where t.transaction_type = 'ALLOCATION'), 0) as allocated,
  coalesce(sum(t.amount) filter (where t.transaction_type = 'COMMITMENT'), 0)
    - coalesce(sum(t.amount) filter (where t.transaction_type = 'RELEASE'), 0) as committed,
  coalesce(sum(t.amount) filter (where t.transaction_type = 'EXPENSE'), 0)
    - coalesce(sum(t.amount) filter (where t.transaction_type = 'REFUND'), 0)
    + coalesce(sum(t.amount * t.adjustment_sign) filter (where t.transaction_type = 'ADJUSTMENT'), 0) as spent,
  b.total_budget
    - (
        coalesce(sum(t.amount) filter (where t.transaction_type = 'EXPENSE'), 0)
        - coalesce(sum(t.amount) filter (where t.transaction_type = 'REFUND'), 0)
        + coalesce(sum(t.amount * t.adjustment_sign) filter (where t.transaction_type = 'ADJUSTMENT'), 0)
      ) as remaining,
  b.total_budget
    - (
        coalesce(sum(t.amount) filter (where t.transaction_type = 'COMMITMENT'), 0)
        - coalesce(sum(t.amount) filter (where t.transaction_type = 'RELEASE'), 0)
      )
    - (
        coalesce(sum(t.amount) filter (where t.transaction_type = 'EXPENSE'), 0)
        - coalesce(sum(t.amount) filter (where t.transaction_type = 'REFUND'), 0)
        + coalesce(sum(t.amount * t.adjustment_sign) filter (where t.transaction_type = 'ADJUSTMENT'), 0)
      ) as available
from public.budgets b
left join public.budget_transactions t on t.budget_id = b.id
group by b.id;

grant select on public.v_budget_summary to authenticated;

create or replace view public.v_budget_category_summary
with (security_invoker = true)
as
select
  ba.budget_id,
  ba.category_id,
  bc.name as category_name,
  ba.allocated_amount,
  coalesce(sum(t.amount) filter (where t.transaction_type = 'COMMITMENT'), 0)
    - coalesce(sum(t.amount) filter (where t.transaction_type = 'RELEASE'), 0) as committed,
  coalesce(sum(t.amount) filter (where t.transaction_type = 'EXPENSE'), 0)
    - coalesce(sum(t.amount) filter (where t.transaction_type = 'REFUND'), 0)
    + coalesce(sum(t.amount * t.adjustment_sign) filter (where t.transaction_type = 'ADJUSTMENT'), 0) as spent,
  ba.allocated_amount
    - (
        coalesce(sum(t.amount) filter (where t.transaction_type = 'COMMITMENT'), 0)
        - coalesce(sum(t.amount) filter (where t.transaction_type = 'RELEASE'), 0)
      )
    - (
        coalesce(sum(t.amount) filter (where t.transaction_type = 'EXPENSE'), 0)
        - coalesce(sum(t.amount) filter (where t.transaction_type = 'REFUND'), 0)
        + coalesce(sum(t.amount * t.adjustment_sign) filter (where t.transaction_type = 'ADJUSTMENT'), 0)
      ) as available
from public.budget_allocations ba
join public.budget_categories bc on bc.id = ba.category_id
left join public.budget_transactions t on t.budget_id = ba.budget_id and t.category_id = ba.category_id
group by ba.budget_id, ba.category_id, bc.name, ba.allocated_amount;

grant select on public.v_budget_category_summary to authenticated;

create or replace function public.after_write_budget_allocation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_currency_id uuid;
  v_delta numeric;
begin
  select currency_id into v_currency_id from public.budgets where id = new.budget_id;

  if tg_op = 'INSERT' then
    v_delta := new.allocated_amount;
  else
    v_delta := new.allocated_amount - old.allocated_amount;
  end if;

  if v_delta <> 0 then
    insert into public.budget_transactions (company_id, budget_id, category_id, amount, currency_id, transaction_type, adjustment_sign, reference_type, reference_id, description, created_by)
    values (new.company_id, new.budget_id, new.category_id, abs(v_delta), v_currency_id, 'ALLOCATION',
      case when v_delta >= 0 then 1 else -1 end, 'budget_allocation', new.id,
      case when tg_op = 'INSERT' then 'Initial allocation' else 'Allocation adjusted' end, auth.uid());
  end if;

  return new;
end;
$$;

create trigger after_write_budget_allocation_trigger
  after insert or update on public.budget_allocations
  for each row execute function public.after_write_budget_allocation();

-- ---------------------------------------------------------------------
-- Manual budget adjustments/refunds -- authorized corrections outside the
-- normal procurement flow (e.g. a billing dispute refund, a manual
-- correction to a miscoded expense).
-- ---------------------------------------------------------------------
create or replace function public.create_budget_adjustment(
  p_budget_id uuid,
  p_category_id uuid,
  p_amount numeric,
  p_currency_id uuid,
  p_type text,
  p_sign smallint default 1,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_id uuid;
begin
  if p_type not in ('ADJUSTMENT', 'REFUND') then
    raise exception 'create_budget_adjustment only supports ADJUSTMENT or REFUND';
  end if;
  if p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  select company_id into v_company_id from public.budgets where id = p_budget_id;
  if v_company_id is null then raise exception 'Budget not found'; end if;
  if not public.has_permission(v_company_id, 'IT.BUDGET.UPDATE') then
    raise exception 'Missing permission IT.BUDGET.UPDATE';
  end if;

  insert into public.budget_transactions (company_id, budget_id, category_id, amount, currency_id, transaction_type, adjustment_sign, description, created_by)
  values (v_company_id, p_budget_id, p_category_id, p_amount, p_currency_id, p_type,
    case when p_type = 'REFUND' then 1 else p_sign end, p_description, auth.uid())
  returning id into v_id;

  perform public.log_audit_event(v_company_id, 'BUDGET_' || p_type, 'budget', p_budget_id,
    jsonb_build_object('amount', p_amount, 'category_id', p_category_id));

  return v_id;
end;
$$;

grant execute on function public.create_budget_adjustment(uuid, uuid, numeric, uuid, text, smallint, text) to authenticated;
