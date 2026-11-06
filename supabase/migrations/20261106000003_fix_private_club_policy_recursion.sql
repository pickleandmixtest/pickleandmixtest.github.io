-- Explicitly isolate club membership checks to avoid recursive RLS policies.
CREATE OR REPLACE FUNCTION private.is_club_member_for_rls(p_club_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog
AS $$
 SELECT EXISTS(SELECT 1 FROM public.club_members cm
   WHERE cm.club_id=p_club_id AND cm.user_id=auth.uid())
$$;
REVOKE ALL ON FUNCTION private.is_club_member_for_rls(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_club_member_for_rls(uuid) TO authenticated;

DROP POLICY IF EXISTS clubs_select_authenticated ON public.clubs;
CREATE POLICY clubs_select_authenticated ON public.clubs FOR SELECT TO authenticated
USING (access_mode<>'private' OR created_by=(SELECT auth.uid()) OR private.is_club_member_for_rls(id));

DROP POLICY IF EXISTS club_members_select_authenticated ON public.club_members;
CREATE POLICY club_members_select_authenticated ON public.club_members FOR SELECT TO authenticated
USING (user_id=(SELECT auth.uid()) OR private.is_club_member_for_rls(club_id)
  OR EXISTS(SELECT 1 FROM public.clubs c WHERE c.id=club_members.club_id AND c.access_mode<>'private'));
