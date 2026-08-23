-- =========================================================================
-- Fix: LEAVE_REQUEST/OVERTIME_REQUEST were added to approval_policies'
-- module CHECK constraint (migration 055) but seed_approval_policies()
-- was never extended to actually seed a default catch-all policy for
-- them, the same way PURCHASE_REQUEST/PURCHASE_ORDER already are. Without
-- this, submit_leave_request()/submit_overtime_request() would find zero
-- applicable policies and the request would sit in SUBMITTED forever with
-- no approval row to ever decide -- the same class of bug fixed for
-- procurement in migration 044, now recurring here for the same reason.
-- =========================================================================
create or replace function public.seed_approval_policies()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.approval_policies (company_id, module, minimum_amount, maximum_amount, required_permission, approval_sequence)
  values
    (new.id, 'PURCHASE_REQUEST', 0, null, 'IT.PROCUREMENT.APPROVE', 1),
    (new.id, 'PURCHASE_ORDER', 0, null, 'IT.PROCUREMENT.APPROVE_PO', 1),
    (new.id, 'LEAVE_REQUEST', 0, null, 'HR.LEAVE.APPROVE', 1),
    (new.id, 'OVERTIME_REQUEST', 0, null, 'HR.OVERTIME.APPROVE', 1);
  return new;
end;
$$;

insert into public.approval_policies (company_id, module, minimum_amount, maximum_amount, required_permission, approval_sequence)
select c.id, m.module, 0, null, m.required_permission, 1
from public.companies c
cross join (values
  ('LEAVE_REQUEST', 'HR.LEAVE.APPROVE'),
  ('OVERTIME_REQUEST', 'HR.OVERTIME.APPROVE')
) as m(module, required_permission)
where not exists (
  select 1 from public.approval_policies ap where ap.company_id = c.id and ap.module = m.module
);
