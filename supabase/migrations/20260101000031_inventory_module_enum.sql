-- Inventory becomes its own toggleable module, independent of IT/Ticketing --
-- Platform Superadmin can enable/disable it per company the same way as
-- every other module. New enum value is added in its own migration/
-- transaction so it's safely usable by name in the very next migration.
alter type public.module_key add value 'INVENTORY';
