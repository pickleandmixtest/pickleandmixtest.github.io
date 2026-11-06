create or replace function public.notify_club_members_of_new_post()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_club_name text;
begin
  select c.name into v_club_name from public.clubs c where c.id = new.club_id;
  insert into public.profile_notifications (user_id, notification_type, reference_id, title, body)
  select distinct cm.user_id, 'club_post_created', new.id::text,
    'Nueva publicación en ' || coalesce(v_club_name, 'tu club'), new.title
  from public.club_members cm
  where cm.club_id = new.club_id and cm.user_id <> new.created_by;
  return new;
end;
$$;

create or replace function public.notify_club_members_of_new_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_club_name text;
begin
  select c.name into v_club_name from public.clubs c where c.id = new.club_id;
  insert into public.profile_notifications (user_id, notification_type, reference_id, title, body)
  select distinct cm.user_id, 'club_event_created', new.id::text,
    'Nuevo evento en ' || coalesce(v_club_name, 'tu club'),
    new.title || ' · ' || to_char(new.starts_at at time zone 'Europe/Madrid', 'DD/MM/YYYY HH24:MI')
  from public.club_members cm
  where cm.club_id = new.club_id and cm.user_id <> new.created_by;
  return new;
end;
$$;

revoke all on function public.notify_club_members_of_new_post() from public, anon, authenticated;
revoke all on function public.notify_club_members_of_new_event() from public, anon, authenticated;

drop trigger if exists club_posts_notify_members_after_insert on public.club_posts;
create trigger club_posts_notify_members_after_insert after insert on public.club_posts
for each row execute function public.notify_club_members_of_new_post();

drop trigger if exists club_events_notify_members_after_insert on public.club_events;
create trigger club_events_notify_members_after_insert after insert on public.club_events
for each row execute function public.notify_club_members_of_new_event();

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='profile_notifications') then
    alter publication supabase_realtime add table public.profile_notifications;
  end if;
end;
$$;