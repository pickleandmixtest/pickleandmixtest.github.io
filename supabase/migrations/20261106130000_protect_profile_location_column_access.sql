-- Keep profile discovery fields available to signed-in users, but never expose
-- raw location columns through the public REST table endpoint.
REVOKE ALL PRIVILEGES ON TABLE public.profiles FROM anon;

REVOKE SELECT ON TABLE public.profiles FROM authenticated;

GRANT SELECT (
  id,
  display_name,
  alias,
  avatar_url,
  stats_visibility,
  history_visibility,
  location_visibility,
  created_at,
  updated_at,
  preferred_language
) ON TABLE public.profiles TO authenticated;
