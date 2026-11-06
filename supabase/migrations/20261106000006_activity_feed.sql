-- Feed cronológico de actividad con acceso limitado al usuario autenticado.
-- Solo muestra partidos de amistades aceptadas con historial visible y contenido de clubes propios.
create or replace function public.get_activity_feed(
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
  if v_uid is null then
    raise exception 'Debes iniciar sesión.' using errcode = '42501';
  end if;
  if v_filter not in ('all', 'friends', 'clubs') then
    raise exception 'Filtro no válido.' using errcode = '22023';
  end if;

  with accepted_friends as (
    select case when f.requester_id = v_uid then f.addressee_id else f.requester_id end as user_id
    from public.friendships f
    where f.status = 'accepted'
      and (f.requester_id = v_uid or f.addressee_id = v_uid)
  ),
  my_clubs as (
    select cm.club_id
    from public.club_members cm
    where cm.user_id = v_uid
  ),
  friend_matches as (
    select distinct on (m.id)
      'match:' || m.id::text as id,
      'match'::text as kind,
      'friends'::text as source,
      m.played_at as created_at,
      sp.user_id as actor_id,
      coalesce(pr.display_name, sp.player_name, 'Jugador') as actor_name,
      pr.alias as actor_alias,
      pr.avatar_url as actor_avatar,
      null::uuid as club_id,
      null::text as club_name,
      coalesce(nullif(s.title, ''), 'Quedada') as title,
      case
        when (mp.side = 'a' and m.side_a_score > m.side_b_score)
          or (mp.side = 'b' and m.side_b_score > m.side_a_score)
        then 'Victoria · ' || case when mp.side = 'a' then m.side_a_score else m.side_b_score end::text || '–' ||
          case when mp.side = 'a' then m.side_b_score else m.side_a_score end::text
        else 'Partido disputado · ' || case when mp.side = 'a' then m.side_a_score else m.side_b_score end::text || '–' ||
          case when mp.side = 'a' then m.side_b_score else m.side_a_score end::text
      end as summary,
      jsonb_build_object('session_id', s.id, 'match_id', m.id, 'won', case when mp.side = 'a' then m.side_a_score > m.side_b_score else m.side_b_score > m.side_a_score end, 'own_score', case when mp.side = 'a' then m.side_a_score else m.side_b_score end, 'opponent_score', case when mp.side = 'a' then m.side_b_score else m.side_a_score end) as details
    from public.play_session_matches m
    join public.play_sessions s on s.id = m.session_id
    join public.play_match_players mp on mp.match_id = m.id
    join public.play_session_players sp on sp.id = mp.session_player_id
    join accepted_friends af on af.user_id = sp.user_id
    left join public.profiles pr on pr.id = sp.user_id
    where sp.approval_status = 'accepted'
      and private.can_view_user_history(sp.user_id)
    order by m.id, sp.user_id
  ),
  club_posts as (
    select
      'post:' || p.id::text as id,
      'club_post'::text as kind,
      'clubs'::text as source,
      p.created_at,
      p.created_by as actor_id,
      coalesce(pr.display_name, 'Jugador') as actor_name,
      pr.alias as actor_alias,
      pr.avatar_url as actor_avatar,
      c.id as club_id,
      c.name as club_name,
      p.title,
      left(p.body, 260) as summary,
      jsonb_build_object('post_id', p.id) as details
    from public.club_posts p
    join my_clubs mc on mc.club_id = p.club_id
    join public.clubs c on c.id = p.club_id
    left join public.profiles pr on pr.id = p.created_by
  ),
  club_events as (
    select
      'event:' || ev.id::text as id,
      'club_event'::text as kind,
      'clubs'::text as source,
      ev.created_at,
      ev.created_by as actor_id,
      coalesce(pr.display_name, 'Jugador') as actor_name,
      pr.alias as actor_alias,
      pr.avatar_url as actor_avatar,
      c.id as club_id,
      c.name as club_name,
      ev.title,
      left(ev.description, 260) as summary,
      jsonb_build_object('event_id', ev.id, 'starts_at', ev.starts_at, 'event_type', ev.event_type, 'location', ev.location) as details
    from public.club_events ev
    join my_clubs mc on mc.club_id = ev.club_id
    join public.clubs c on c.id = ev.club_id
    left join public.profiles pr on pr.id = ev.created_by
    where ev.status <> 'cancelled'
  ),
  combined as (
    select * from friend_matches where v_filter in ('all', 'friends')
    union all
    select * from club_posts where v_filter in ('all', 'clubs')
    union all
    select * from club_events where v_filter in ('all', 'clubs')
  ),
  page as (
    select *
    from combined x
    where (p_before is null or x.created_at < p_before
      or (x.created_at = p_before and x.id < coalesce(p_before_id, chr(127))))
    order by x.created_at desc, x.id desc
    limit v_limit + 1
  )
  select coalesce(jsonb_agg(to_jsonb(page) order by page.created_at desc, page.id desc), '[]'::jsonb)
    into v_result
  from page;

  return v_result;
end;
$function$;

revoke all on function public.get_activity_feed(text, timestamptz, text, integer) from public;
revoke all on function public.get_activity_feed(text, timestamptz, text, integer) from anon;
grant execute on function public.get_activity_feed(text, timestamptz, text, integer) to authenticated;
