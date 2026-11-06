-- Keep client-side event logging limited to genuine match-start events.
-- System activity is inserted by the SECURITY DEFINER trigger function.
REVOKE INSERT ON TABLE public.activity_events FROM authenticated;
GRANT INSERT (actor_id, event_type, tag)
ON TABLE public.activity_events TO authenticated;

DROP POLICY IF EXISTS "Users can log own match starts" ON public.activity_events;
CREATE POLICY "Users can log own match starts"
ON public.activity_events
FOR INSERT
TO authenticated
WITH CHECK (
  actor_id = (SELECT auth.uid())
  AND event_type = 'match_started'
  AND tag = 'matches'
);
