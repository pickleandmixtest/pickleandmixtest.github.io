create or replace function private.get_profile_friend_count(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select count(*)::integer
  from public.friendships f
  where auth.uid() is not null
    and p_user_id is not null
    and f.status = 'accepted'
    and (f.requester_id = p_user_id or f.addressee_id = p_user_id);
$$;

revoke all on function private.get_profile_friend_count(uuid) from public, anon;
grant execute on function private.get_profile_friend_count(uuid) to authenticated;

create or replace function public.get_profile_friend_count(p_user_id uuid)
returns integer
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  select private.get_profile_friend_count(p_user_id);
$$;

revoke all on function public.get_profile_friend_count(uuid) from public, anon;
grant execute on function public.get_profile_friend_count(uuid) to authenticated;
