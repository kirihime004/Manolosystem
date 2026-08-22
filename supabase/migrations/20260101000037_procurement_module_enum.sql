-- Budget & Procurement is a substantial capability, so -- matching how
-- Inventory was made independently toggleable -- Platform Superadmin can
-- turn it on/off per company as its own module. Standalone migration so
-- the enum value is safely usable by name in the next one.
alter type public.module_key add value 'PROCUREMENT';
