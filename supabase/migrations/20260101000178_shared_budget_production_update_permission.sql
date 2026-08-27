-- =========================================================================
-- Fix: the previous permissions migration seeded PRODUCTION.BUDGET.CREATE
-- and PRODUCTION.BUDGET.DELETE but not PRODUCTION.BUDGET.UPDATE, assuming
-- the pre-existing PRODUCTION.BUDGET.MANAGE would cover it -- but
-- can_edit_budget() constructs the permission key literally as
-- '<MODULE>.BUDGET.<ACTION>', so a Production budget's UPDATE checks
-- would always fail with no PRODUCTION.BUDGET.UPDATE row to match.
-- =========================================================================

insert into public.permissions (key, module_key, resource, action, description) values
  ('PRODUCTION.BUDGET.UPDATE', 'PRODUCTION', 'BUDGET', 'UPDATE', 'Edit a Production department budget and its lines')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.is_system and r.name in ('Admin', 'Director', 'Producer') and p.key = 'PRODUCTION.BUDGET.UPDATE'
on conflict (role_id, permission_id) do nothing;
