-- Set search_path for functions to prevent search_path hijacking
-- This ensures functions always use the public schema explicitly

ALTER FUNCTION public.get_roster_version_at(p_team_id TEXT, p_timestamp TIMESTAMPTZ)
  SET search_path = public;

ALTER FUNCTION public.get_roster_version_for_round(p_team_id TEXT, p_round_number INTEGER)
  SET search_path = public;

ALTER FUNCTION public.update_updated_at()
  SET search_path = public;
