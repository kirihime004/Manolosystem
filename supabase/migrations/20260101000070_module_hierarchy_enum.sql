-- =========================================================================
-- Introduces a real parent/child module hierarchy. Until now "IT" was
-- simultaneously the master switch AND the literal toggle ticketing's own
-- RLS checked -- there was no way to turn Ticketing off while leaving
-- Inventory/Budget & Procurement (which already have their own keys)
-- alone. This adds four new leaf keys so every IT/HR sub-feature has its
-- own switch, with IT and HR becoming pure master switches in the next
-- migration. Enum values are added in their own migration/transaction so
-- they're safe to reference from the migration that follows.
-- =========================================================================
alter type public.module_key add value 'TICKETING';
alter type public.module_key add value 'HR_EMPLOYEES';
alter type public.module_key add value 'HR_ATTENDANCE_LEAVE';
alter type public.module_key add value 'HR_PAYROLL';
