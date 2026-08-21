-- Extensions required by the platform
create extension if not exists "pgcrypto" with schema extensions;

-- Generic updated_at trigger helper, reused by every table with an updated_at column.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
