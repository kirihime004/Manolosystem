-- Bug fix: derive_ticket_child_company_id() was shared between
-- ticket_comments and ticket_attachments, and referenced NEW.comment_id
-- (guarded by `tg_table_name = 'ticket_attachments'`). PL/pgSQL resolves
-- RECORD field access against the actual runtime tuple descriptor
-- independent of short-circuit evaluation of the surrounding boolean
-- expression, so firing this on ticket_comments (which has no comment_id
-- column) raised: record "new" has no field "comment_id". Splitting into
-- two single-purpose functions avoids ever referencing a column that
-- doesn't exist on the table the trigger is actually attached to.

create or replace function public.derive_ticket_comment_company_id()
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
  return new;
end;
$$;

create or replace function public.derive_ticket_attachment_company_id()
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

  if new.comment_id is not null then
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

drop trigger if exists derive_ticket_comments_company_id_trigger on public.ticket_comments;
create trigger derive_ticket_comments_company_id_trigger
  before insert or update on public.ticket_comments
  for each row execute function public.derive_ticket_comment_company_id();

drop trigger if exists derive_ticket_attachments_company_id_trigger on public.ticket_attachments;
create trigger derive_ticket_attachments_company_id_trigger
  before insert or update on public.ticket_attachments
  for each row execute function public.derive_ticket_attachment_company_id();

drop function if exists public.derive_ticket_child_company_id();
