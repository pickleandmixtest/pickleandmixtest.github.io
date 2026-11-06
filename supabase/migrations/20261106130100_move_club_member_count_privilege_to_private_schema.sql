CREATE OR REPLACE FUNCTION private.get_club_member_counts_core()
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

REVOKE ALL ON FUNCTION private.get_club_member_counts_core() FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_club_member_counts_core() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_club_member_counts()
RETURNS TABLE (club_id uuid, member_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT * FROM private.get_club_member_counts_core();
$$;

REVOKE ALL ON FUNCTION public.get_club_member_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_club_member_counts() TO authenticated;
