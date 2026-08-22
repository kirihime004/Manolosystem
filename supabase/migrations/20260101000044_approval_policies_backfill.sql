-- seed_approval_policies() only fires on new company creation -- backfill
-- the default catch-all policy for companies that already existed before
-- Phase 3 shipped, so submit_purchase_request()/create_purchase_order_from_pr()
-- never get permanently stuck with zero applicable approval levels.
insert into public.approval_policies (company_id, module, minimum_amount, maximum_amount, required_permission, approval_sequence)
select c.id, m.module, 0, null, m.required_permission, 1
from public.companies c
cross join (values
  ('PURCHASE_REQUEST', 'IT.PROCUREMENT.APPROVE'),
  ('PURCHASE_ORDER', 'IT.PROCUREMENT.APPROVE_PO')
) as m(module, required_permission)
where not exists (
  select 1 from public.approval_policies ap where ap.company_id = c.id and ap.module = m.module
);
