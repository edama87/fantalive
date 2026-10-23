-- Formazioni consigliate (scritte dall'assistente via API, lette dal pannello admin).
-- Additiva e reversibile: DROP TABLE public.lineup_suggestions;
CREATE TABLE IF NOT EXISTS public.lineup_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id TEXT NOT NULL DEFAULT 'ap' REFERENCES public.teams(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL CHECK (round_number > 0),
  variant TEXT NOT NULL DEFAULT 'principale',
  status TEXT NOT NULL DEFAULT 'proposta' CHECK (status IN ('bozza', 'proposta', 'confermata', 'scartata')),
  formation TEXT NOT NULL CHECK (formation ~ '^[1-6]-[1-6](-[1-6]){0,2}$'),
  opponent_team_id TEXT REFERENCES public.teams(id) ON DELETE SET NULL,
  starters JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(starters) = 'array'),
  bench JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(bench) = 'array'),
  rationale TEXT,
  alternatives JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(alternatives) = 'array'),
  expected_points NUMERIC(6,2),
  sources JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(sources) = 'array'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, round_number, variant)
);

CREATE INDEX IF NOT EXISTS lineup_suggestions_round_idx
  ON public.lineup_suggestions (team_id, round_number DESC, updated_at DESC);

DROP TRIGGER IF EXISTS update_lineup_suggestions_updated_at ON public.lineup_suggestions;
CREATE TRIGGER update_lineup_suggestions_updated_at
  BEFORE UPDATE ON public.lineup_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS attiva senza policy: anon/authenticated non leggono né scrivono;
-- solo service_role (chiave segreta, lato server) bypassa RLS.
ALTER TABLE public.lineup_suggestions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lineup_suggestions FROM anon, authenticated;
