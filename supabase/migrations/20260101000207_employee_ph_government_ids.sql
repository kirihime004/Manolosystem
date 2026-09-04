-- =========================================================================
-- Philippine statutory government IDs on the employee master record --
-- TIN, SSS, PhilHealth, and Pag-IBIG numbers. Free-form text (formats vary
-- by agency and era; no cross-agency validation is enforced here). Nullable
-- and additive -- no RLS changes needed, same table, same policies.
-- =========================================================================
alter table public.employees
  add column tin text,
  add column sss_number text,
  add column philhealth_number text,
  add column pagibig_number text;
