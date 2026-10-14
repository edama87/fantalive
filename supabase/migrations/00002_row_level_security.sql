-- FantaLive Bundlesliga - Row Level Security
-- Supabase RLS Policies
-- Public read, server-side writes only (via service role)

-- =============================================================================
-- ENABLE RLS ON ALL TABLES
-- =============================================================================

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_pairings ENABLE ROW LEVEL SECURITY;
ALTER TABLE lineups ENABLE ROW LEVEL SECURITY;
ALTER TABLE lineup_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE official_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE serie_a_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE standings ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE cron_runs ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- PUBLIC READ POLICIES (anon and authenticated can SELECT)
-- =============================================================================

-- Teams: public read
DROP POLICY IF EXISTS "Teams are publicly readable" ON teams;
CREATE POLICY "Teams are publicly readable" ON teams
    FOR SELECT USING (true);

-- Players: public read
DROP POLICY IF EXISTS "Players are publicly readable" ON players;
CREATE POLICY "Players are publicly readable" ON players
    FOR SELECT USING (true);

-- Player aliases: public read
DROP POLICY IF EXISTS "Player aliases are publicly readable" ON player_aliases;
CREATE POLICY "Player aliases are publicly readable" ON player_aliases
    FOR SELECT USING (true);

-- Roster versions: public read
DROP POLICY IF EXISTS "Roster versions are publicly readable" ON roster_versions;
CREATE POLICY "Roster versions are publicly readable" ON roster_versions
    FOR SELECT USING (true);

-- Roster players: public read
DROP POLICY IF EXISTS "Roster players are publicly readable" ON roster_players;
CREATE POLICY "Roster players are publicly readable" ON roster_players
    FOR SELECT USING (true);

-- Market transactions: public read
DROP POLICY IF EXISTS "Market transactions are publicly readable" ON market_transactions;
CREATE POLICY "Market transactions are publicly readable" ON market_transactions
    FOR SELECT USING (true);

-- Rounds: public read
DROP POLICY IF EXISTS "Rounds are publicly readable" ON rounds;
CREATE POLICY "Rounds are publicly readable" ON rounds
    FOR SELECT USING (true);

-- Match pairings: public read
DROP POLICY IF EXISTS "Match pairings are publicly readable" ON match_pairings;
CREATE POLICY "Match pairings are publicly readable" ON match_pairings
    FOR SELECT USING (true);

-- Lineups: public read
DROP POLICY IF EXISTS "Lineups are publicly readable" ON lineups;
CREATE POLICY "Lineups are publicly readable" ON lineups
    FOR SELECT USING (true);

-- Lineup slots: public read
DROP POLICY IF EXISTS "Lineup slots are publicly readable" ON lineup_slots;
CREATE POLICY "Lineup slots are publicly readable" ON lineup_slots
    FOR SELECT USING (true);

-- Live events: public read
DROP POLICY IF EXISTS "Live events are publicly readable" ON live_events;
CREATE POLICY "Live events are publicly readable" ON live_events
    FOR SELECT USING (true);

-- Live votes: public read
DROP POLICY IF EXISTS "Live votes are publicly readable" ON live_votes;
CREATE POLICY "Live votes are publicly readable" ON live_votes
    FOR SELECT USING (true);

-- Official votes: public read
DROP POLICY IF EXISTS "Official votes are publicly readable" ON official_votes;
CREATE POLICY "Official votes are publicly readable" ON official_votes
    FOR SELECT USING (true);

-- Serie A matches: public read
DROP POLICY IF EXISTS "Serie A matches are publicly readable" ON serie_a_matches;
CREATE POLICY "Serie A matches are publicly readable" ON serie_a_matches
    FOR SELECT USING (true);

-- Match scores: public read
DROP POLICY IF EXISTS "Match scores are publicly readable" ON match_scores;
CREATE POLICY "Match scores are publicly readable" ON match_scores
    FOR SELECT USING (true);

-- Standings: public read
DROP POLICY IF EXISTS "Standings are publicly readable" ON standings;
CREATE POLICY "Standings are publicly readable" ON standings
    FOR SELECT USING (true);

-- Market windows: public read
DROP POLICY IF EXISTS "Market windows are publicly readable" ON market_windows;
CREATE POLICY "Market windows are publicly readable" ON market_windows
    FOR SELECT USING (true);

-- Cron runs: public read (for debugging/transparency)
DROP POLICY IF EXISTS "Cron runs are publicly readable" ON cron_runs;
CREATE POLICY "Cron runs are publicly readable" ON cron_runs
    FOR SELECT USING (true);

-- =============================================================================
-- WRITE POLICIES (service_role only via server-side API routes)
-- Note: service_role bypasses RLS by default, so no explicit policies needed
-- These are here for documentation and if we want to add authenticated user writes later
-- =============================================================================

-- For reference: To allow authenticated users to write their own lineups, uncomment:
-- CREATE POLICY "Users can insert their own lineups" ON lineups
--     FOR INSERT WITH CHECK (
--         team_id IN (SELECT id FROM teams WHERE manager_email = auth.jwt() ->> 'email')
--     );
-- CREATE POLICY "Users can update their own lineups" ON lineups
--     FOR UPDATE USING (
--         team_id IN (SELECT id FROM teams WHERE manager_email = auth.jwt() ->> 'email')
--     );
