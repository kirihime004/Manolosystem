-- =========================================================================
-- PHASE 6: Administration -- Meetings. Room reservation reuses
-- room_bookings (migration 106) directly via room_booking_id rather than
-- re-implementing overlap prevention -- a meeting's room slot is enforced
-- by the exact same prevent_overlapping_room_booking_trigger every other
-- room booking goes through.
-- =========================================================================
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  organizer_id uuid not null references public.employees(id) on delete restrict,
  room_booking_id uuid references public.room_bookings(id) on delete set null,
  title text not null,
  purpose text,
  agenda text,
  meeting_date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'SCHEDULED' check (status in ('SCHEDULED', 'CANCELLED', 'COMPLETED')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);

create index meetings_company_idx on public.meetings (company_id, meeting_date);

create trigger set_meetings_updated_at
  before update on public.meetings
  for each row execute function public.set_updated_at();

alter table public.meetings enable row level security;

create table public.meeting_participants (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  response_status text not null default 'INVITED' check (response_status in ('INVITED', 'ACCEPTED', 'DECLINED', 'TENTATIVE')),
  created_at timestamptz not null default now(),
  unique (meeting_id, employee_id)
);

alter table public.meeting_participants enable row level security;

create or replace function public.derive_meeting_participant_company_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  select m.company_id into new.company_id from public.meetings m where m.id = new.meeting_id;
  if new.company_id is null then raise exception 'Invalid meeting_id'; end if;
  return new;
end;
$$;

create trigger derive_meeting_participant_company_id_trigger
  before insert or update on public.meeting_participants
  for each row execute function public.derive_meeting_participant_company_id();

-- ---------------------------------------------------------------------
-- RLS -- a meeting is visible to anyone with ADMIN.MEETINGS.VIEW, its
-- organizer, or an invited participant.
-- ---------------------------------------------------------------------
create policy "meetings_select" on public.meetings
  for select
  using (
    public.has_company_access(company_id)
    and (
      public.has_permission(company_id, 'ADMIN.MEETINGS.VIEW')
      or public.is_own_employee(organizer_id)
      or exists (select 1 from public.meeting_participants mp where mp.meeting_id = id and public.is_own_employee(mp.employee_id))
    )
  );
create policy "meetings_insert" on public.meetings
  for insert
  with check (
    public.has_company_access(company_id) and public.has_module_enabled(company_id, 'ADMIN')
    and (public.has_permission(company_id, 'ADMIN.MEETINGS.CREATE') or public.is_own_employee(organizer_id))
  );
create policy "meetings_update" on public.meetings
  for update
  using (public.has_company_access(company_id) and (public.has_permission(company_id, 'ADMIN.MEETINGS.MANAGE') or public.is_own_employee(organizer_id)))
  with check (public.has_company_access(company_id));
create policy "meetings_delete" on public.meetings
  for delete
  using (public.has_company_access(company_id) and (public.has_permission(company_id, 'ADMIN.MEETINGS.MANAGE') or public.is_own_employee(organizer_id)));

create policy "meeting_participants_select" on public.meeting_participants
  for select
  using (
    public.has_company_access(company_id)
    and (
      public.has_permission(company_id, 'ADMIN.MEETINGS.VIEW')
      or public.is_own_employee(employee_id)
      or exists (select 1 from public.meetings m where m.id = meeting_id and public.is_own_employee(m.organizer_id))
    )
  );
create policy "meeting_participants_insert" on public.meeting_participants
  for insert
  with check (
    public.has_company_access(company_id)
    and exists (
      select 1 from public.meetings m where m.id = meeting_id
        and (public.has_permission(company_id, 'ADMIN.MEETINGS.MANAGE') or public.is_own_employee(m.organizer_id))
    )
  );
create policy "meeting_participants_update" on public.meeting_participants
  for update
  using (public.has_company_access(company_id) and public.is_own_employee(employee_id))
  with check (public.has_company_access(company_id));
create policy "meeting_participants_delete" on public.meeting_participants
  for delete
  using (
    public.has_company_access(company_id)
    and exists (
      select 1 from public.meetings m where m.id = meeting_id
        and (public.has_permission(company_id, 'ADMIN.MEETINGS.MANAGE') or public.is_own_employee(m.organizer_id))
    )
  );

-- ---------------------------------------------------------------------
-- schedule_meeting -- creates the room_booking (if a room was requested)
-- and the meeting row together; the booking's own overlap trigger rejects
-- double-booking before either row commits.
-- ---------------------------------------------------------------------
create or replace function public.schedule_meeting(
  p_company_id uuid, p_organizer_id uuid, p_title text, p_meeting_date date,
  p_start_time time, p_end_time time, p_room_id uuid default null,
  p_purpose text default null, p_agenda text default null, p_attendees integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_room_booking_id uuid;
  v_meeting_id uuid;
begin
  if not public.has_company_access(p_company_id) then raise exception 'Access denied'; end if;
  if not (public.has_permission(p_company_id, 'ADMIN.MEETINGS.CREATE') or public.is_own_employee(p_organizer_id)) then
    raise exception 'Access denied';
  end if;

  if p_room_id is not null then
    insert into public.room_bookings (company_id, room_id, requester_id, booking_date, start_time, end_time, purpose, attendees, status)
    values (p_company_id, p_room_id, p_organizer_id, p_meeting_date, p_start_time, p_end_time, p_title, p_attendees, 'CONFIRMED')
    returning id into v_room_booking_id;
  end if;

  insert into public.meetings (company_id, organizer_id, room_booking_id, title, purpose, agenda, meeting_date, start_time, end_time)
  values (p_company_id, p_organizer_id, v_room_booking_id, p_title, p_purpose, p_agenda, p_meeting_date, p_start_time, p_end_time)
  returning id into v_meeting_id;

  perform public.log_admin_event(p_company_id, 'MEETING', v_meeting_id, 'SCHEDULED', null, 'SCHEDULED');

  return v_meeting_id;
end;
$$;

grant execute on function public.schedule_meeting(uuid, uuid, text, date, time, time, uuid, text, text, integer) to authenticated;
