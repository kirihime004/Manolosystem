-- =========================================================================
-- PHASE 6: Administration -- splits the single flat ADMIN module into real
-- independent leaf sub-modules, the same treatment IT (070/071), HR
-- (070/071), and Finance (098/099) already got. Admin's ~19 nav sections
-- are grouped into 10 cohesive leaves (rather than one leaf per page,
-- which would cost ~30-45 migration lines each per the Finance precedent,
-- or leaving it flat, which no longer matches what the user wants):
--
--   ADMIN_REQUESTS   -- Requests, request categories/settings
--   ADMIN_FACILITIES -- Locations/Buildings/Floors, Rooms, Room Bookings, Workspaces
--   ADMIN_SUPPLIES   -- Office Supplies, Supply Requests
--   ADMIN_ASSETS     -- Administrative Assets, Maintenance
--   ADMIN_VEHICLES   -- Vehicles
--   ADMIN_TRAVEL     -- Travel
--   ADMIN_VISITORS   -- Visitors, Meetings
--   ADMIN_EVENTS     -- Events
--   ADMIN_CONTRACTS  -- Contracts, Documents, Compliance
--   ADMIN_COMMS      -- Announcements, Courier/Mail
--
-- Enum values need their own transaction before the next migration can
-- reference them, exactly like every prior hierarchy split.
-- =========================================================================
alter type public.module_key add value 'ADMIN_REQUESTS';
alter type public.module_key add value 'ADMIN_FACILITIES';
alter type public.module_key add value 'ADMIN_SUPPLIES';
alter type public.module_key add value 'ADMIN_ASSETS';
alter type public.module_key add value 'ADMIN_VEHICLES';
alter type public.module_key add value 'ADMIN_TRAVEL';
alter type public.module_key add value 'ADMIN_VISITORS';
alter type public.module_key add value 'ADMIN_EVENTS';
alter type public.module_key add value 'ADMIN_CONTRACTS';
alter type public.module_key add value 'ADMIN_COMMS';
