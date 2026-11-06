create or replace function private.get_activity_feed(
  p_filter text default 'all',
  p_before timestamptz default null,
  p_before_id text default null,
  p_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $function$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
  v_filter text := coalesce(p_filter, 'all');
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 40));
begin
  if v_uid is null then raise exception 'Debes iniciar sesión.' using errcode = '42501'; end if;
  if v_filter not in ('all', 'friends', 'clubs') then raise exception 'Filtro no válido.' using errcode = '22023'; end if;
  with accepted_friends as (
    select case when f.requester_id = v_uid then f.addressee_id else f.requester_id end as user_id
    from public.friendships f
    where f.status = 'accepted' and (f.requester_id = v_uid or f.addressee_id = v_uid)
  ),
  my_clubs as (
    select cm.club_id from public.club_members cm where cm.user_id = v_uid
  ),
  session_player_stats as (
    select
      m.session_id,
      sp.id as session_player_id,
      sp.user_id,
      sp.player_name,
      count(*)::integer as played,
      count(*) filter (where (mp.side = 'a' and m.side_a_score > m.side_b_score) or (mp.side = 'b' and m.side_b_score > m.side_a_score))::integer as wins,
      coalesce(sum(case when mp.side = 'a' then m.side_a_score else m.side_b_score end),0)::integer as points_for,
      coalesce(sum(case when mp.side = 'a' then m.side_b_score else m.side_a_score end),0)::integer as points_against,
      max(m.played_at) as last_played_at
    from public.play_session_matches m
    join public.play_match_players mp on mp.match_id = m.id
    join public.play_session_players sp on sp.id = mp.session_player_id
    where sp.approval_status = 'accepted'
      and m.played_at is not null
      and m.side_a_score is not null and m.side_b_score is not null
    group by m.session_id, sp.id, sp.user_id, sp.player_name
  ),
  ranked_session_players as (
    select
      x.*,
      row_number() over (
        partition by x.session_id
        order by x.wins desc, (x.points_for - x.points_against) desc, x.points_for desc, x.player_name asc, x.session_player_id
      )::integer as position,
      count(*) over (partition by x.session_id)::integer as player_count,
      max(x.last_played_at) over (partition by x.session_id) as session_ended_at
    from session_player_stats x
  ),
  friend_sessions as (
    select distinct on (rsp.session_id)
      'session:' || rsp.session_id::text as id,
      'session'::text as kind,
      'friends'::text as source,
      rsp.session_ended_at as created_at,
      rsp.user_id as actor_id,
      coalesce(pr.display_name, rsp.player_name, 'Jugador') as actor_name,
      pr.alias as actor_alias,
      pr.avatar_url as actor_avatar,
      null::uuid as club_id,
      null::text as club_name,
      coalesce(nullif(s.title, ''), 'Quedada') as title,
      ''::text as summary,
      jsonb_build_object('session_id', rsp.session_id, 'player_count', rsp.player_count, 'position', rsp.position) as details
    from ranked_session_players rsp
    join accepted_friends af on af.user_id = rsp.user_id
    join public.play_sessions s on s.id = rsp.session_id
    left join public.profiles pr on pr.id = rsp.user_id
    where rsp.user_id is not null and private.can_view_user_history(rsp.user_id)
    order by rsp.session_id, rsp.played desc, rsp.wins desc, rsp.last_played_at desc, rsp.user_id
  ),
  club_posts as (
    select 'post:' || p.id::text as id, 'club_post'::text as kind, 'clubs'::text as source,
      p.created_at, p.created_by as actor_id, coalesce(pr.display_name, 'Jugador') as actor_name,
      pr.alias as actor_alias, pr.avatar_url as actor_avatar, c.id as club_id, c.name as club_name,
      p.title, left(p.body, 260) as summary, jsonb_build_object('post_id', p.id) as details
    from public.club_posts p
    join my_clubs mc on mc.club_id = p.club_id
    join public.clubs c on c.id = p.club_id
    left join public.profiles pr on pr.id = p.created_by
  ),
  club_events as (
    select 'event:' || ev.id::text as id, 'club_event'::text as kind, 'clubs'::text as source,
      ev.created_at, ev.created_by as actor_id, coalesce(pr.display_name, 'Jugador') as actor_name,
      pr.alias as actor_alias, pr.avatar_url as actor_avatar, c.id as club_id, c.name as club_name,
      ev.title, left(ev.description, 260) as summary,
      jsonb_build_object('event_id', ev.id, 'starts_at', ev.starts_at, 'event_type', ev.event_type, 'location', ev.location) as details
    from public.club_events ev
    join my_clubs mc on mc.club_id = ev.club_id
    join public.clubs c on c.id = ev.club_id
    left join public.profiles pr on pr.id = ev.created_by
    where ev.status <> 'cancelled'
  ),
  combined as (
    select * from friend_sessions where v_filter in ('all','friends')
    union all select * from club_posts where v_filter in ('all','clubs')
    union all select * from club_events where v_filter in ('all','clubs')
  ),
  page as (
    select * from combined x
    where p_before is null or x.created_at < p_before
      or (x.created_at = p_before and x.id < coalesce(p_before_id, chr(127)))
    order by x.created_at desc, x.id desc limit v_limit + 1
  )
  select coalesce(jsonb_agg(to_jsonb(page) order by page.created_at desc, page.id desc), '[]'::jsonb)
  into v_result from page;
  return v_result;
end;
$function$;
