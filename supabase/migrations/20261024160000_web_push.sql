-- Web Push: iscrizioni dei dispositivi e notifiche già inviate (deduplica).
-- Accesso solo dal server (service role): RLS attiva e nessuna policy per anon/authenticated.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint        text NOT NULL UNIQUE,
  p256dh          text NOT NULL,
  auth            text NOT NULL,
  team_id         text NOT NULL,
  -- { enabled, minutesBefore, liveEnabled, live: { <evento>: { ours, opp } } }
  prefs           jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_agent      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  last_success_at timestamptz,
  failure_count   integer NOT NULL DEFAULT 0,
  last_error      text
);
CREATE INDEX IF NOT EXISTS push_subscriptions_team_idx ON public.push_subscriptions (team_id);

CREATE TABLE IF NOT EXISTS public.sent_notifications (
  subscription_id uuid NOT NULL REFERENCES public.push_subscriptions (id) ON DELETE CASCADE,
  -- 'r{giornata}:{giocatore}:{tipo}:{n}', 'r{giornata}:kickoff-{partita}-{minuti}', 'test:{minuto}'
  event_key       text NOT NULL,
  sent_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subscription_id, event_key)
);
CREATE INDEX IF NOT EXISTS sent_notifications_sent_at_idx ON public.sent_notifications (sent_at);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sent_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_subscriptions FROM anon, authenticated;
REVOKE ALL ON public.sent_notifications FROM anon, authenticated;

COMMENT ON TABLE public.push_subscriptions IS 'Web Push: un dispositivo iscritto (endpoint) con squadra e preferenze. Solo service role.';
COMMENT ON TABLE public.sent_notifications IS 'Web Push: notifiche già inviate per iscrizione (deduplica). Solo service role.';
