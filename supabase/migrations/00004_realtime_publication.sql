-- Enable Supabase Realtime on live tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_events, public.live_votes, public.match_scores, public.serie_a_matches;
