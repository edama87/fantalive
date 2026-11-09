-- Commenti qualitativi a fondo pagina sfida (analisi + nota ironica).
-- Additiva e reversibile: DROP TABLE public.match_comments;
CREATE TABLE IF NOT EXISTS public.match_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_number INTEGER NOT NULL CHECK (round_number > 0),
  home_team_id TEXT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  away_team_id TEXT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  analysis TEXT NOT NULL CHECK (char_length(btrim(analysis)) > 0),
  ironic_note TEXT NOT NULL CHECK (char_length(btrim(ironic_note)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT match_comments_teams_distinct CHECK (home_team_id <> away_team_id),
  CONSTRAINT match_comments_round_match_unique UNIQUE (round_number, home_team_id, away_team_id)
);

CREATE INDEX IF NOT EXISTS match_comments_round_idx
  ON public.match_comments (round_number DESC);

DROP TRIGGER IF EXISTS update_match_comments_updated_at ON public.match_comments;
CREATE TRIGGER update_match_comments_updated_at
  BEFORE UPDATE ON public.match_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Come lineup_debriefs: RLS senza policy, solo service_role (API server).
ALTER TABLE public.match_comments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.match_comments FROM anon, authenticated;

-- Articolo di giornata (testata giornalistica).
CREATE TABLE IF NOT EXISTS public.round_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_number INTEGER NOT NULL UNIQUE CHECK (round_number > 0),
  headline TEXT NOT NULL CHECK (char_length(btrim(headline)) > 0),
  subtitle TEXT NULL,
  body TEXT NOT NULL CHECK (char_length(btrim(body)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS update_round_articles_updated_at ON public.round_articles;
CREATE TRIGGER update_round_articles_updated_at
  BEFORE UPDATE ON public.round_articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.round_articles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.round_articles FROM anon, authenticated;
