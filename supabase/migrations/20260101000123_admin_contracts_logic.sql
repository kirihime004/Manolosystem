-- =========================================================================
-- PHASE 6: Administration -- contract renewal/termination RPCs.
-- =========================================================================
create or replace function public.renew_admin_contract(
  p_contract_id uuid, p_new_start_date date, p_new_end_date date, p_new_value numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_old public.admin_contracts;
  v_new_id uuid;
begin
  select * into v_old from public.admin_contracts where id = p_contract_id for update;
  if v_old is null then raise exception 'Contract not found'; end if;
  if not public.has_permission(v_old.company_id, 'ADMIN.CONTRACTS.RENEW') then raise exception 'Access denied'; end if;
  if v_old.status not in ('ACTIVE', 'EXPIRING', 'EXPIRED') then raise exception 'Only an active/expiring/expired contract can be renewed'; end if;

  insert into public.admin_contracts (
    company_id, contract_name, contract_type, supplier_id, start_date, end_date,
    value, currency_id, payment_terms, owner_id, status, renewed_from_id, notes
  ) values (
    v_old.company_id, v_old.contract_name, v_old.contract_type, v_old.supplier_id, p_new_start_date, p_new_end_date,
    coalesce(p_new_value, v_old.value), v_old.currency_id, v_old.payment_terms, v_old.owner_id, 'ACTIVE', p_contract_id, v_old.notes
  )
  returning id into v_new_id;

  update public.admin_contracts set status = 'RENEWED' where id = p_contract_id;

  perform public.log_admin_event(v_old.company_id, 'ADMIN_CONTRACT', p_contract_id, 'RENEWED', v_old.status, 'RENEWED',
    jsonb_build_object('renewed_into', v_new_id));
  perform public.log_admin_event(v_old.company_id, 'ADMIN_CONTRACT', v_new_id, 'CREATED', null, 'ACTIVE',
    jsonb_build_object('renewed_from', p_contract_id));

  return v_new_id;
end;
$$;

grant execute on function public.renew_admin_contract(uuid, date, date, numeric) to authenticated;

create or replace function public.terminate_admin_contract(p_contract_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_contract public.admin_contracts;
begin
  select * into v_contract from public.admin_contracts where id = p_contract_id for update;
  if v_contract is null then raise exception 'Contract not found'; end if;
  if not public.has_permission(v_contract.company_id, 'ADMIN.CONTRACTS.RENEW') then raise exception 'Access denied'; end if;
  if v_contract.status in ('TERMINATED', 'CANCELLED') then raise exception 'This contract is already closed'; end if;

  update public.admin_contracts set status = 'TERMINATED' where id = p_contract_id;
  perform public.log_admin_event(v_contract.company_id, 'ADMIN_CONTRACT', p_contract_id, 'TERMINATED', v_contract.status, 'TERMINATED', '{}', p_reason);
end;
$$;

grant execute on function public.terminate_admin_contract(uuid, text) to authenticated;

create or replace function public.activate_admin_contract(p_contract_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_contract public.admin_contracts;
begin
  select * into v_contract from public.admin_contracts where id = p_contract_id for update;
  if v_contract is null then raise exception 'Contract not found'; end if;
  if not public.has_permission(v_contract.company_id, 'ADMIN.CONTRACTS.UPDATE') then raise exception 'Access denied'; end if;
  if v_contract.status <> 'DRAFT' then raise exception 'Only a draft contract can be activated'; end if;

  update public.admin_contracts set status = 'ACTIVE' where id = p_contract_id;
  perform public.log_admin_event(v_contract.company_id, 'ADMIN_CONTRACT', p_contract_id, 'ACTIVATED', 'DRAFT', 'ACTIVE');
end;
$$;

grant execute on function public.activate_admin_contract(uuid) to authenticated;
