-- Privacy and security hardening for Pickle&Mix TEST.
-- Profile location is exposed only through a privacy-aware RPC.
REVOKE SELECT ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, display_name, alias, avatar_url, stats_visibility, history_visibility, location_visibility, preferred_language)
ON TABLE public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.get_profile_location(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_visibility text;
  v_city text;
  v_country text;
  v_allowed boolean := false;
BEGIN
  IF v_uid IS NULL OR p_user_id IS NULL THEN RAISE EXCEPTION 'No autorizado.' USING ERRCODE = '42501'; END IF;
  SELECT p.location_visibility,p.city,p.country INTO v_visibility,v_city,v_country
  FROM public.profiles p WHERE p.id=p_user_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_uid=p_user_id OR v_visibility='everyone' THEN v_allowed:=true;
  ELSIF v_visibility='friends' THEN
    SELECT EXISTS(SELECT 1 FROM public.friendships f WHERE f.status='accepted'
      AND ((f.requester_id=v_uid AND f.addressee_id=p_user_id)
        OR (f.addressee_id=v_uid AND f.requester_id=p_user_id))) INTO v_allowed;
  END IF;
  IF NOT v_allowed THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('city',v_city,'country',v_country);
END;
$$;
REVOKE ALL ON FUNCTION public.get_profile_location(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_location(uuid) TO authenticated;

-- Safe helper prevents recursive RLS evaluation between clubs and club_members.
CREATE OR REPLACE FUNCTION private.is_club_member_for_rls(p_club_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $$
 SELECT EXISTS(SELECT 1 FROM public.club_members cm
   WHERE cm.club_id=p_club_id AND cm.user_id=auth.uid())
$$;
REVOKE ALL ON FUNCTION private.is_club_member_for_rls(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_club_member_for_rls(uuid) TO authenticated;

DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
CREATE POLICY profiles_select_authenticated ON public.profiles FOR SELECT TO authenticated
USING (id=(SELECT auth.uid()) OR alias IS NOT NULL);

DROP POLICY IF EXISTS clubs_select_authenticated ON public.clubs;
CREATE POLICY clubs_select_authenticated ON public.clubs FOR SELECT TO authenticated
USING (access_mode<>'private' OR created_by=(SELECT auth.uid()) OR private.is_club_member_for_rls(id));

DROP POLICY IF EXISTS club_members_select_authenticated ON public.club_members;
CREATE POLICY club_members_select_authenticated ON public.club_members FOR SELECT TO authenticated
USING (user_id=(SELECT auth.uid()) OR private.is_club_member_for_rls(club_id)
  OR EXISTS(SELECT 1 FROM public.clubs c WHERE c.id=club_members.club_id AND c.access_mode<>'private'));

DROP POLICY IF EXISTS profile_achievements_select_authenticated ON public.profile_achievements;
CREATE POLICY profile_achievements_select_authenticated ON public.profile_achievements FOR SELECT TO authenticated
USING (user_id=(SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.get_profile_achievement_summary(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_matches integer:=0; v_sessions integer:=0; v_tournaments integer:=0;
  v_friends integer:=0; v_clubs integer:=0; v_founded integer:=0; v_organized integer:=0;
  v_xp integer:=0; v_level integer:=1; v_next integer:=100; v_earned jsonb:='[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL OR p_user_id IS NULL THEN RAISE EXCEPTION 'No autorizado.' USING ERRCODE='42501'; END IF;
  IF p_user_id<>auth.uid() AND NOT private.can_view_user_stats(p_user_id) THEN
    RAISE EXCEPTION 'Este usuario no comparte sus estadísticas contigo.' USING ERRCODE='42501';
  END IF;
  SELECT count(DISTINCT m.id),count(DISTINCT s.id),
    count(DISTINCT m.session_id) FILTER(WHERE m.phase IN ('group','knockout'))
  INTO v_matches,v_sessions,v_tournaments
  FROM public.play_session_players sp JOIN public.play_sessions s ON s.id=sp.session_id
  LEFT JOIN public.play_match_players mp ON mp.session_player_id=sp.id
  LEFT JOIN public.play_session_matches m ON m.id=mp.match_id
  WHERE sp.user_id=p_user_id AND sp.approval_status='accepted';
  SELECT count(*) INTO v_friends FROM public.friendships f WHERE f.status='accepted'
    AND (f.requester_id=p_user_id OR f.addressee_id=p_user_id);
  SELECT count(*) INTO v_clubs FROM public.club_members cm WHERE cm.user_id=p_user_id;
  SELECT count(*) INTO v_founded FROM public.clubs c WHERE c.created_by=p_user_id;
  SELECT count(*) INTO v_organized FROM public.play_sessions s WHERE s.owner_id=p_user_id
    AND EXISTS(SELECT 1 FROM public.play_session_matches m WHERE m.session_id=s.id);
  v_xp:=v_matches*10+v_tournaments*50+v_friends*10+v_clubs*20+v_founded*50+v_organized*20;
  v_level:=CASE WHEN v_xp>=5000 THEN 8 WHEN v_xp>=3000 THEN 7 WHEN v_xp>=1800 THEN 6
    WHEN v_xp>=1000 THEN 5 WHEN v_xp>=600 THEN 4 WHEN v_xp>=300 THEN 3 WHEN v_xp>=100 THEN 2 ELSE 1 END;
  v_next:=CASE v_level WHEN 1 THEN 100 WHEN 2 THEN 300 WHEN 3 THEN 600 WHEN 4 THEN 1000
    WHEN 5 THEN 1800 WHEN 6 THEN 3000 WHEN 7 THEN 5000 ELSE 5000 END;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',badge_id,'earned_at',earned_at) ORDER BY earned_at),'[]'::jsonb)
    INTO v_earned FROM public.profile_achievements WHERE user_id=p_user_id;
  RETURN jsonb_build_object('xp',v_xp,'level',v_level,'next_level_xp',v_next,
    'metrics',CASE WHEN p_user_id=auth.uid() THEN jsonb_build_object('matches',v_matches,'sessions',v_sessions,
      'tournaments',v_tournaments,'friends',v_friends,'clubs',v_clubs,'founded_clubs',v_founded,
      'organized_sessions',v_organized) ELSE '{}'::jsonb END,'earned',v_earned);
END;
$$;
REVOKE ALL ON FUNCTION public.get_profile_achievement_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_achievement_summary(uuid) TO authenticated;

DROP POLICY IF EXISTS clubs_delete_creator ON public.clubs;
CREATE POLICY clubs_delete_creator ON public.clubs FOR DELETE TO authenticated
USING (created_by=(SELECT auth.uid()) AND club_type<>'official');

CREATE OR REPLACE FUNCTION public.prevent_official_club_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog
AS $$
BEGIN
  IF OLD.club_type='official' OR OLD.official_status='verified' THEN
    RAISE EXCEPTION 'Los clubes oficiales no se pueden eliminar desde la plataforma.';
  END IF;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.prevent_official_club_delete() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS prevent_official_club_delete ON public.clubs;
CREATE TRIGGER prevent_official_club_delete BEFORE DELETE ON public.clubs
FOR EACH ROW EXECUTE FUNCTION public.prevent_official_club_delete();

REVOKE SELECT ON TABLE public.minigame_scores FROM PUBLIC, anon, authenticated;
GRANT SELECT (game_key,player_name,score,updated_at) ON TABLE public.minigame_scores TO anon,authenticated;

DROP POLICY IF EXISTS club_members_delete_self ON public.club_members;

CREATE INDEX IF NOT EXISTS admin_audit_log_actor_id_idx ON public.admin_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS app_admins_created_by_idx ON public.app_admins(created_by);
CREATE INDEX IF NOT EXISTS club_event_registrations_user_id_idx ON public.club_event_registrations(user_id);
CREATE INDEX IF NOT EXISTS club_events_created_by_idx ON public.club_events(created_by);
CREATE INDEX IF NOT EXISTS club_invitations_invited_by_idx ON public.club_invitations(invited_by);
CREATE INDEX IF NOT EXISTS club_invitations_invited_user_id_idx ON public.club_invitations(invited_user_id);
CREATE INDEX IF NOT EXISTS club_invite_links_created_by_idx ON public.club_invite_links(created_by);
CREATE INDEX IF NOT EXISTS club_join_requests_user_id_idx ON public.club_join_requests(user_id);
CREATE INDEX IF NOT EXISTS club_post_comments_user_id_idx ON public.club_post_comments(user_id);
CREATE INDEX IF NOT EXISTS club_posts_created_by_idx ON public.club_posts(created_by);
CREATE INDEX IF NOT EXISTS minigame_scores_user_id_idx ON public.minigame_scores(user_id);

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT p.oid::regprocedure AS signature FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef
  LOOP EXECUTE format('ALTER FUNCTION %s SET search_path = pg_catalog',r.signature); END LOOP;
END;
$$;
