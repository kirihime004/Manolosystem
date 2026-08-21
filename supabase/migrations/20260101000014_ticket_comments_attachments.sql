create table public.ticket_comments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index ticket_comments_ticket_id_idx on public.ticket_comments (ticket_id, created_at);

alter table public.ticket_comments enable row level security;

-- Attachments may hang off a ticket directly or off a specific comment.
create table public.ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  comment_id uuid references public.ticket_comments(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  file_size bigint,
  mime_type text,
  created_at timestamptz not null default now()
);

create index ticket_attachments_ticket_id_idx on public.ticket_attachments (ticket_id, created_at);

alter table public.ticket_attachments enable row level security;

-- Derive company_id server-side from the parent ticket for both tables, and
-- validate a comment_id (if present) belongs to the same ticket.
create or replace function public.derive_ticket_child_company_id()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_company_id uuid;
begin
  select t.company_id into v_company_id from public.tickets t where t.id = new.ticket_id;
  if v_company_id is null then
    raise exception 'Invalid ticket_id';
  end if;
  new.company_id := v_company_id;

  if tg_table_name = 'ticket_attachments' and new.comment_id is not null then
    if not exists (
      select 1 from public.ticket_comments c
      where c.id = new.comment_id and c.ticket_id = new.ticket_id
    ) then
      raise exception 'comment_id does not belong to ticket_id';
    end if;
  end if;

  return new;
end;
$$;

create trigger derive_ticket_comments_company_id_trigger
  before insert or update on public.ticket_comments
  for each row execute function public.derive_ticket_child_company_id();

create trigger derive_ticket_attachments_company_id_trigger
  before insert or update on public.ticket_attachments
  for each row execute function public.derive_ticket_child_company_id();

-- A user may act on a ticket's comments/attachments if they could see the
-- ticket itself: requester, assignee, or holder of the broad VIEW permission.
create or replace function public.can_view_ticket(p_ticket_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.tickets t
    where t.id = p_ticket_id
      and public.has_company_access(t.company_id)
      and public.has_module_enabled(t.company_id, 'IT')
      and (
        t.requester_id = auth.uid()
        or t.assigned_to = auth.uid()
        or public.has_permission(t.company_id, 'IT.TICKETS.VIEW')
      )
  );
$$;

grant execute on function public.can_view_ticket(uuid) to authenticated;

create policy "ticket_comments_select" on public.ticket_comments
  for select
  using (public.can_view_ticket(ticket_id));

create policy "ticket_comments_insert" on public.ticket_comments
  for insert
  with check (
    author_id = auth.uid()
    and public.can_view_ticket(ticket_id)
    and public.has_permission(company_id, 'IT.TICKETS.COMMENT')
  );

create policy "ticket_attachments_select" on public.ticket_attachments
  for select
  using (public.can_view_ticket(ticket_id));

create policy "ticket_attachments_insert" on public.ticket_attachments
  for insert
  with check (
    uploaded_by = auth.uid()
    and public.can_view_ticket(ticket_id)
    and public.has_permission(company_id, 'IT.TICKETS.COMMENT')
  );

-- After a comment is inserted, drop an audit trail entry.
create or replace function public.after_insert_ticket_comment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.log_audit_event(new.company_id, 'TICKET_COMMENT_ADDED', 'ticket', new.ticket_id,
    jsonb_build_object('comment_id', new.id));
  return new;
end;
$$;

create trigger after_insert_ticket_comment_trigger
  after insert on public.ticket_comments
  for each row execute function public.after_insert_ticket_comment();

create or replace function public.after_insert_ticket_attachment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.log_audit_event(new.company_id, 'TICKET_ATTACHMENT_UPLOADED', 'ticket', new.ticket_id,
    jsonb_build_object('attachment_id', new.id, 'file_name', new.file_name));
  return new;
end;
$$;

create trigger after_insert_ticket_attachment_trigger
  after insert on public.ticket_attachments
  for each row execute function public.after_insert_ticket_attachment();
