-- =========================================================================
-- Fix: before_insert_production_sequence() multiplied the user-entered
-- sequence_number by 10 before formatting it into sequence_code (e.g.
-- entering 1 produced "SQ010"), while the equivalent shot trigger uses
-- the entered number as-is (entering 1 produces "SH001"). That silent,
-- undocumented asymmetry is exactly what a user reported as confusing
-- ("i add sequence = 1, it shows SQ010, i read it as sequence 10").
--
-- Sequences numbered in tens (SQ010, SQ020, SQ030...) so a new one can
-- be inserted later (SQ015) without renumbering is a real, useful
-- convention -- but it belongs to what the user types, not a hidden
-- multiplication behind their back. Now sequence_code reflects the
-- entered number directly, same as shots; a company that wants the
-- insertion-room convention just types 10/20/30 for its own sequences.
-- =========================================================================
create or replace function public.before_insert_production_sequence()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.sequence_code is null or new.sequence_code = '' then
    new.sequence_code := 'SQ' || lpad(new.sequence_number::text, 3, '0');
  end if;
  return new;
end;
$$;
