-- Prevent users from triggering waitlist promotion without cancelling their own registration.
CREATE OR REPLACE FUNCTION public.cancel_club_event_registration(p_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  v_event public.club_events;
  v_promote uuid;
  v_deleted integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_event
  FROM public.club_events
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El evento no existe.';
  END IF;

  DELETE FROM public.club_event_registrations
  WHERE event_id = p_event_id
    AND user_id = auth.uid();

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted = 0 THEN
    RAISE EXCEPTION 'No tienes una inscripción activa en este evento.';
  END IF;

  IF v_event.capacity IS NOT NULL
     AND v_event.status = 'scheduled'
     AND v_event.starts_at > now() THEN
    SELECT id INTO v_promote
    FROM public.club_event_registrations
    WHERE event_id = p_event_id
      AND status = 'waitlist'
    ORDER BY created_at, id
    LIMIT 1;

    IF v_promote IS NOT NULL
       AND (SELECT count(*)
            FROM public.club_event_registrations
            WHERE event_id = p_event_id
              AND status = 'registered') < v_event.capacity THEN
      UPDATE public.club_event_registrations
      SET status = 'registered'
      WHERE id = v_promote;
    END IF;
  END IF;
END;
$function$;
