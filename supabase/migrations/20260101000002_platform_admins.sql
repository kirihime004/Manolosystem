-- Platform Superadmin registry.
-- Membership here grants control over the entire ManoloSystem platform and is
-- completely separate from any company membership/role.
create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

-- No policies are defined for regular clients: platform_admins is only ever
-- read through the SECURITY DEFINER helper functions created later, and only
-- ever written via the service role (Supabase Dashboard / trusted server code).
