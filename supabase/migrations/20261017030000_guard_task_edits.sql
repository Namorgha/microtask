-- Task content (title, description, price, location, ...) may only be changed
-- by the poster, while the task is still open and nobody has requested it.
-- Status/doer changes made by the payment and workflow functions are unaffected.
create or replace function public.guard_task_content_edits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.title, new.description, new.category, new.price, new.duration,
      new.location, new.lat, new.lng, new.images)
     is not distinct from
     (old.title, old.description, old.category, old.price, old.duration,
      old.location, old.lat, old.lng, old.images) then
    return new; -- content unchanged (status, doer, flags, ...)
  end if;

  -- Trusted server-side contexts (service role, SQL editor) and admins.
  if auth.uid() is null or public.has_role(auth.uid(), 'admin') then
    return new;
  end if;

  if auth.uid() is distinct from old.poster_id then
    raise exception 'Only the poster can edit this task' using errcode = '42501';
  end if;

  if old.status <> 'open' then
    raise exception 'This task can no longer be edited' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.task_applications
    where task_id = old.id and status <> 'rejected'
  ) then
    raise exception 'This task already has requests, so it can no longer be edited'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_task_content_edits on public.tasks;
create trigger trg_guard_task_content_edits
  before update on public.tasks
  for each row execute function public.guard_task_content_edits();
