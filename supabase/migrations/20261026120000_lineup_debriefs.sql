-- Debrief delle formazioni consigliate (generati a mano dal pannello admin).
-- Additiva e reversibile: DROP TABLE public.lineup_debriefs;
CREATE TABLE IF NOT EXISTS public.lineup_debriefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id UUID NOT NULL UNIQUE REFERENCES public.lineup_suggestions(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL CHECK (round_number > 0),
  consolidated BOOLEAN NOT NULL DEFAULT FALSE,
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lineup_debriefs_round_idx
  ON public.lineup_debriefs (team_id, round_number DESC);

DROP TRIGGER IF EXISTS update_lineup_debriefs_updated_at ON public.lineup_debriefs;
CREATE TRIGGER update_lineup_debriefs_updated_at
  BEFORE UPDATE ON public.lineup_debriefs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Come lineup_suggestions: RLS senza policy, solo service_role.
ALTER TABLE public.lineup_debriefs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lineup_debriefs FROM anon, authenticated;
