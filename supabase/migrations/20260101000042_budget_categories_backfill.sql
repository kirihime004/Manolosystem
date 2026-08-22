-- seed_budget_categories() only fires on new company creation -- backfill
-- the default category set for companies that already existed before
-- Phase 3 shipped (Toon City etc).
insert into public.budget_categories (company_id, name, is_system)
select c.id, cat.name, true
from public.companies c
cross join (values
  ('Hardware'), ('Software'), ('Software Subscriptions'), ('Networking'), ('Servers'),
  ('Cloud Services'), ('Licensing'), ('Security'), ('Maintenance'), ('Repairs'),
  ('IT Services'), ('Consulting'), ('Training'), ('Telecommunications'), ('Other')
) as cat(name)
on conflict (company_id, name) do nothing;
