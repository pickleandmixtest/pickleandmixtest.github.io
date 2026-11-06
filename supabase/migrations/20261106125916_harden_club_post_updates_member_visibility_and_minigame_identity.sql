-- 1) Prevent authenticated users from changing the ownership/location of a club post.
-- Keep the editable content columns used by the application.
REVOKE UPDATE ON TABLE public.club_posts FROM authenticated;
GRANT UPDATE (title, body, comments_enabled)
ON TABLE public.club_posts TO authenticated;

-- 2) Membership lists are visible to all signed-in users only for open clubs.
-- Approval and private club rosters remain visible to their members only.
DROP POLICY IF EXISTS club_members_select_authenticated ON public.club_members;
CREATE POLICY club_members_select_authenticated
ON public.club_members
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR private.is_club_member_for_rls(club_id)
  OR EXISTS (
    SELECT 1
    FROM public.clubs c
    WHERE c.id = club_members.club_id
      AND c.access_mode = 'open'
  )
);

-- Return aggregate member counts without exposing member identities.
-- Private club counts are returned only to members of that club.
CREATE OR REPLACE FUNCTION public.get_club_member_counts()
RETURNS TABLE (club_id uuid, member_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT c.id, count(cm.user_id)::bigint
  FROM public.clubs c
  LEFT JOIN public.club_members cm ON cm.club_id = c.id
  WHERE auth.uid() IS NOT NULL
    AND (
      c.access_mode IN ('open', 'approval')
      OR EXISTS (
        SELECT 1
        FROM public.club_members own
        WHERE own.club_id = c.id
          AND own.user_id = auth.uid()
      )
    )
  GROUP BY c.id;
$$;

REVOKE ALL ON FUNCTION public.get_club_member_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_club_member_counts() TO authenticated;

-- 3) Derive the leaderboard display name from the caller's own profile.
-- Keep the existing RPC signature for backwards compatibility; p_player_name is ignored.
CREATE OR REPLACE FUNCTION private.submit_minigame_score(
  p_game_key text,
  p_score integer,
  p_player_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_name text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para guardar una puntuación';
  END IF;

  IF p_game_key IS NULL OR p_game_key NOT IN ('pong', 'kitchen', 'dink') THEN
    RAISE EXCEPTION 'Minijuego no válido';
  END IF;

  IF p_score IS NULL OR p_score < 0 OR p_score > 1000000 THEN
    RAISE EXCEPTION 'Puntuación no válida';
  END IF;

  SELECT CASE
    WHEN NULLIF(btrim(p.alias), '') IS NOT NULL THEN '@' || btrim(p.alias)
    ELSE btrim(p.display_name)
  END
  INTO v_name
  FROM public.profiles p
  WHERE p.id = v_user_id;

  IF NOT FOUND OR v_name IS NULL OR char_length(v_name) NOT BETWEEN 1 AND 40 THEN
    RAISE EXCEPTION 'No se ha encontrado un nombre de perfil válido';
  END IF;

  INSERT INTO public.minigame_scores (game_key, user_id, player_name, score, updated_at)
  VALUES (p_game_key, v_user_id, v_name, p_score, now())
  ON CONFLICT (game_key, user_id) DO UPDATE
    SET score = EXCLUDED.score,
        player_name = EXCLUDED.player_name,
        updated_at = now()
    WHERE EXCLUDED.score > public.minigame_scores.score;
END;
$$;
