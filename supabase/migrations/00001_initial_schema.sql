-- FantaLive Bundlesliga - Initial Schema
-- Supabase PostgreSQL Migration
-- Idempotent: uses CREATE IF NOT EXISTS / DO blocks

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- TEAMS: Fantasy teams in the league
-- =============================================================================
CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    manager_name TEXT NOT NULL,
    manager_email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE teams IS 'Fantasy teams participating in the Bundlesliga';

-- =============================================================================
-- PLAYERS: All Serie A players available for fantasy
-- =============================================================================
CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('P', 'D', 'C', 'A')),
    real_team TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    auction_price INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_players_role ON players(role);
CREATE INDEX IF NOT EXISTS idx_players_real_team ON players(real_team);
CREATE INDEX IF NOT EXISTS idx_players_active ON players(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_players_name ON players(name);

COMMENT ON TABLE players IS 'All Serie A players available in the fantasy game';
COMMENT ON COLUMN players.role IS 'P=Portiere, D=Difensore, C=Centrocampista, A=Attaccante';

-- =============================================================================
-- PLAYER_ALIASES: Manual alias mappings for ESPN name resolution
-- =============================================================================
CREATE TABLE IF NOT EXISTS player_aliases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    alias TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'espn',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(alias, source)
);

CREATE INDEX IF NOT EXISTS idx_player_aliases_alias ON player_aliases(alias);
CREATE INDEX IF NOT EXISTS idx_player_aliases_player ON player_aliases(player_id);

COMMENT ON TABLE player_aliases IS 'Manual name mappings for external data sources (ESPN, etc.)';

-- =============================================================================
-- ROSTER_VERSIONS: Point-in-time snapshots of team rosters
-- Each roster version is valid from effective_from until the next version
-- =============================================================================
CREATE TABLE IF NOT EXISTS roster_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    effective_from TIMESTAMPTZ NOT NULL,
    effective_until TIMESTAMPTZ,
    credits_remaining INTEGER NOT NULL DEFAULT 260,
    market_credits INTEGER NOT NULL DEFAULT 60,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(team_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_roster_versions_team ON roster_versions(team_id);
CREATE INDEX IF NOT EXISTS idx_roster_versions_effective ON roster_versions(effective_from, effective_until);

COMMENT ON TABLE roster_versions IS 'Point-in-time roster snapshots; each round uses the version valid at kickoff';
COMMENT ON COLUMN roster_versions.credits_remaining IS 'Auction credits remaining (from initial 260)';
COMMENT ON COLUMN roster_versions.market_credits IS 'Weekly market credits (initial 60, accumulates unused)';

-- =============================================================================
-- ROSTER_PLAYERS: Players in each roster version
-- =============================================================================
CREATE TABLE IF NOT EXISTS roster_players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    roster_version_id UUID NOT NULL REFERENCES roster_versions(id) ON DELETE CASCADE,
    player_id TEXT NOT NULL REFERENCES players(id),
    acquisition_type TEXT NOT NULL CHECK (acquisition_type IN ('auction', 'market', 'initial')),
    acquisition_price INTEGER NOT NULL DEFAULT 0,
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(roster_version_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_roster_players_version ON roster_players(roster_version_id);
CREATE INDEX IF NOT EXISTS idx_roster_players_player ON roster_players(player_id);

COMMENT ON TABLE roster_players IS 'Players belonging to a specific roster version';

-- =============================================================================
-- MARKET_TRANSACTIONS: History of all market operations
-- =============================================================================
CREATE TABLE IF NOT EXISTS market_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('buy', 'sell', 'auction', 'loan_in', 'loan_out')),
    player_id TEXT NOT NULL REFERENCES players(id),
    credits_paid INTEGER NOT NULL DEFAULT 0,
    credits_refunded INTEGER NOT NULL DEFAULT 0,
    market_week INTEGER,
    effective_round INTEGER,
    release_reason TEXT,
    is_loan BOOLEAN NOT NULL DEFAULT FALSE,
    is_injured BOOLEAN NOT NULL DEFAULT FALSE,
    loan_return_round INTEGER,
    raw_import_data JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_transactions_team ON market_transactions(team_id);
CREATE INDEX IF NOT EXISTS idx_market_transactions_player ON market_transactions(player_id);
CREATE INDEX IF NOT EXISTS idx_market_transactions_week ON market_transactions(market_week);
CREATE INDEX IF NOT EXISTS idx_market_transactions_date ON market_transactions(created_at);

COMMENT ON TABLE market_transactions IS 'Complete history of market buy/sell operations';
COMMENT ON COLUMN market_transactions.credits_refunded IS 'Refund depends on release reason (left_serie_a vs still_in_serie_a)';

-- =============================================================================
-- ROUNDS: Fantasy league rounds mapped to Serie A matchdays
-- =============================================================================
CREATE TABLE IF NOT EXISTS rounds (
    number INTEGER PRIMARY KEY,
    serie_a_matchday INTEGER NOT NULL,
    kickoff_date DATE NOT NULL,
    kickoff_time TIME,
    pairing_cycle TEXT NOT NULL CHECK (pairing_cycle IN ('A','B','C','D','E','F','G','H','I')),
    is_home_swapped BOOLEAN NOT NULL DEFAULT FALSE,
    lineup_deadline TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'finished')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rounds_status ON rounds(status);
CREATE INDEX IF NOT EXISTS idx_rounds_kickoff ON rounds(kickoff_date);

COMMENT ON TABLE rounds IS 'Fantasy rounds with Serie A matchday mapping';

-- =============================================================================
-- MATCH_PAIRINGS: Head-to-head pairings for each round
-- =============================================================================
CREATE TABLE IF NOT EXISTS match_pairings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    round_number INTEGER NOT NULL REFERENCES rounds(number) ON DELETE CASCADE,
    home_team_id TEXT NOT NULL REFERENCES teams(id),
    away_team_id TEXT NOT NULL REFERENCES teams(id),
    
    UNIQUE(round_number, home_team_id),
    UNIQUE(round_number, away_team_id)
);

CREATE INDEX IF NOT EXISTS idx_match_pairings_round ON match_pairings(round_number);

-- =============================================================================
-- LINEUPS: Team lineups for each round
-- =============================================================================
CREATE TABLE IF NOT EXISTS lineups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL REFERENCES rounds(number) ON DELETE CASCADE,
    roster_version_id UUID NOT NULL REFERENCES roster_versions(id),
    formation TEXT NOT NULL CHECK (formation IN ('6-3-1', '5-3-2', '5-4-1', '4-5-1', '4-4-2', '4-3-3', '3-6-1', '3-5-2', '3-4-3')),
    submitted_at TIMESTAMPTZ,
    is_auto_generated BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(team_id, round_number)
);

CREATE INDEX IF NOT EXISTS idx_lineups_round ON lineups(round_number);
CREATE INDEX IF NOT EXISTS idx_lineups_team ON lineups(team_id);

-- =============================================================================
-- LINEUP_SLOTS: Individual player slots in a lineup
-- =============================================================================
CREATE TABLE IF NOT EXISTS lineup_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lineup_id UUID NOT NULL REFERENCES lineups(id) ON DELETE CASCADE,
    player_id TEXT NOT NULL REFERENCES players(id),
    slot_type TEXT NOT NULL CHECK (slot_type IN ('starter', 'bench')),
    position INTEGER NOT NULL,
    
    UNIQUE(lineup_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_lineup_slots_lineup ON lineup_slots(lineup_id);

-- =============================================================================
-- LIVE_EVENTS: Real-time match events from providers
-- =============================================================================
CREATE TABLE IF NOT EXISTS live_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    round_number INTEGER NOT NULL REFERENCES rounds(number),
    player_id TEXT NOT NULL REFERENCES players(id),
    event_type TEXT NOT NULL CHECK (event_type IN (
        'goal', 'penalty_scored', 'penalty_missed', 'penalty_saved',
        'assist', 'own_goal', 'yellow_card', 'red_card',
        'substitution_in', 'substitution_out'
    )),
    minute INTEGER NOT NULL,
    related_player_id TEXT REFERENCES players(id),
    source_provider TEXT NOT NULL,
    source_event_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(round_number, player_id, event_type, minute, source_provider)
);

CREATE INDEX IF NOT EXISTS idx_live_events_round ON live_events(round_number);
CREATE INDEX IF NOT EXISTS idx_live_events_player ON live_events(player_id);
CREATE INDEX IF NOT EXISTS idx_live_events_type ON live_events(event_type);

COMMENT ON TABLE live_events IS 'Real-time events from live data providers';

-- =============================================================================
-- LIVE_VOTES: Estimated votes during matches (from providers)
-- =============================================================================
CREATE TABLE IF NOT EXISTS live_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    round_number INTEGER NOT NULL REFERENCES rounds(number),
    player_id TEXT NOT NULL REFERENCES players(id),
    estimated_vote NUMERIC(3,1),
    is_estimated BOOLEAN NOT NULL DEFAULT TRUE,
    source_rating NUMERIC(3,1),
    minutes_played INTEGER NOT NULL DEFAULT 0,
    is_playing BOOLEAN NOT NULL DEFAULT FALSE,
    is_subbed_out BOOLEAN NOT NULL DEFAULT FALSE,
    source_provider TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(round_number, player_id, source_provider)
);

CREATE INDEX IF NOT EXISTS idx_live_votes_round ON live_votes(round_number);
CREATE INDEX IF NOT EXISTS idx_live_votes_player ON live_votes(player_id);
CREATE INDEX IF NOT EXISTS idx_live_votes_updated ON live_votes(updated_at);

COMMENT ON TABLE live_votes IS 'Estimated votes during live matches (marked stimato until reconciled)';

-- =============================================================================
-- OFFICIAL_VOTES: Final official votes after matches
-- =============================================================================
CREATE TABLE IF NOT EXISTS official_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    round_number INTEGER NOT NULL REFERENCES rounds(number),
    player_id TEXT NOT NULL REFERENCES players(id),
    vote_gazzetta NUMERIC(3,1),
    vote_corriere NUMERIC(3,1),
    vote_tuttosport NUMERIC(3,1),
    vote_average NUMERIC(4,2) GENERATED ALWAYS AS (
        COALESCE(
            (COALESCE(vote_gazzetta, 0) + COALESCE(vote_corriere, 0) + COALESCE(vote_tuttosport, 0)) / 
            NULLIF(
                (CASE WHEN vote_gazzetta IS NOT NULL THEN 1 ELSE 0 END) +
                (CASE WHEN vote_corriere IS NOT NULL THEN 1 ELSE 0 END) +
                (CASE WHEN vote_tuttosport IS NOT NULL THEN 1 ELSE 0 END),
                0
            ),
            NULL
        )
    ) STORED,
    minutes_played INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(round_number, player_id)
);

CREATE INDEX IF NOT EXISTS idx_official_votes_round ON official_votes(round_number);
CREATE INDEX IF NOT EXISTS idx_official_votes_player ON official_votes(player_id);

COMMENT ON TABLE official_votes IS 'Official votes from newspapers (Gazzetta, Corriere, Tuttosport)';
COMMENT ON COLUMN official_votes.vote_average IS 'Calculated average of available votes';

-- =============================================================================
-- SERIE_A_MATCHES: Current state of real Serie A matches
-- =============================================================================
CREATE TABLE IF NOT EXISTS serie_a_matches (
    id TEXT PRIMARY KEY,
    round_number INTEGER NOT NULL REFERENCES rounds(number),
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    home_score INTEGER NOT NULL DEFAULT 0,
    away_score INTEGER NOT NULL DEFAULT 0,
    minute INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'halftime', 'finished')),
    kickoff_time TIMESTAMPTZ,
    venue TEXT,
    source_provider TEXT NOT NULL,
    source_match_id TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_serie_a_matches_round ON serie_a_matches(round_number);
CREATE INDEX IF NOT EXISTS idx_serie_a_matches_status ON serie_a_matches(status);

COMMENT ON TABLE serie_a_matches IS 'Current state of Serie A matches for live display';

-- =============================================================================
-- MATCH_SCORES: Calculated fantasy match scores
-- =============================================================================
CREATE TABLE IF NOT EXISTS match_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    round_number INTEGER NOT NULL REFERENCES rounds(number),
    home_team_id TEXT NOT NULL REFERENCES teams(id),
    away_team_id TEXT NOT NULL REFERENCES teams(id),
    home_total NUMERIC(5,2),
    away_total NUMERIC(5,2),
    home_goals INTEGER,
    away_goals INTEGER,
    home_defense_mod NUMERIC(4,2),
    away_defense_mod NUMERIC(4,2),
    home_midfield_mod NUMERIC(4,2),
    away_midfield_mod NUMERIC(4,2),
    home_attack_mod NUMERIC(4,2),
    away_attack_mod NUMERIC(4,2),
    is_live BOOLEAN NOT NULL DEFAULT TRUE,
    is_final BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(round_number, home_team_id, away_team_id)
);

CREATE INDEX IF NOT EXISTS idx_match_scores_round ON match_scores(round_number);

-- =============================================================================
-- STANDINGS: League standings (updated after each round)
-- =============================================================================
CREATE TABLE IF NOT EXISTS standings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id TEXT NOT NULL REFERENCES teams(id),
    after_round INTEGER NOT NULL REFERENCES rounds(number),
    played INTEGER NOT NULL DEFAULT 0,
    won INTEGER NOT NULL DEFAULT 0,
    drawn INTEGER NOT NULL DEFAULT 0,
    lost INTEGER NOT NULL DEFAULT 0,
    goals_for INTEGER NOT NULL DEFAULT 0,
    goals_against INTEGER NOT NULL DEFAULT 0,
    points INTEGER NOT NULL DEFAULT 0,
    fanta_points NUMERIC(6,2) NOT NULL DEFAULT 0,
    position INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(team_id, after_round)
);

CREATE INDEX IF NOT EXISTS idx_standings_round ON standings(after_round);
CREATE INDEX IF NOT EXISTS idx_standings_position ON standings(after_round, position);

-- =============================================================================
-- MARKET_WINDOWS: Track market opening/closing periods
-- =============================================================================
CREATE TABLE IF NOT EXISTS market_windows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    week_number INTEGER NOT NULL,
    opens_at TIMESTAMPTZ NOT NULL,
    closes_at TIMESTAMPTZ NOT NULL,
    effective_round INTEGER NOT NULL REFERENCES rounds(number),
    is_january_block BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'open', 'closed', 'processing', 'completed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_windows_status ON market_windows(status);
CREATE INDEX IF NOT EXISTS idx_market_windows_dates ON market_windows(opens_at, closes_at);

COMMENT ON TABLE market_windows IS 'Weekly market windows (Mon 00:00 - Thu 18:59), closed in January';

-- =============================================================================
-- CRON_RUNS: Track cron job executions for debugging
-- =============================================================================
CREATE TABLE IF NOT EXISTS cron_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_name TEXT NOT NULL,
    round_number INTEGER,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'error')),
    events_ingested INTEGER DEFAULT 0,
    votes_updated INTEGER DEFAULT 0,
    matches_updated INTEGER DEFAULT 0,
    error_message TEXT,
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_cron_runs_job ON cron_runs(job_name, started_at DESC);

-- =============================================================================
-- FUNCTIONS: Helper functions
-- =============================================================================

-- Get the roster version valid for a specific timestamp
CREATE OR REPLACE FUNCTION get_roster_version_at(
    p_team_id TEXT,
    p_timestamp TIMESTAMPTZ
) RETURNS UUID AS $$
    SELECT id FROM roster_versions
    WHERE team_id = p_team_id
      AND effective_from <= p_timestamp
      AND (effective_until IS NULL OR effective_until > p_timestamp)
    ORDER BY effective_from DESC
    LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- Get the roster version valid for a specific round
CREATE OR REPLACE FUNCTION get_roster_version_for_round(
    p_team_id TEXT,
    p_round_number INTEGER
) RETURNS UUID AS $$
    SELECT get_roster_version_at(
        p_team_id,
        (SELECT kickoff_date + COALESCE(kickoff_time, '00:00:00'::TIME) 
         FROM rounds WHERE number = p_round_number)
    );
$$ LANGUAGE SQL STABLE;

-- =============================================================================
-- TRIGGERS: Auto-update timestamps
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS teams_updated_at ON teams;
CREATE TRIGGER teams_updated_at
    BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS players_updated_at ON players;
CREATE TRIGGER players_updated_at
    BEFORE UPDATE ON players
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS lineups_updated_at ON lineups;
CREATE TRIGGER lineups_updated_at
    BEFORE UPDATE ON lineups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS match_scores_updated_at ON match_scores;
CREATE TRIGGER match_scores_updated_at
    BEFORE UPDATE ON match_scores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS live_votes_updated_at ON live_votes;
CREATE TRIGGER live_votes_updated_at
    BEFORE UPDATE ON live_votes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS serie_a_matches_updated_at ON serie_a_matches;
CREATE TRIGGER serie_a_matches_updated_at
    BEFORE UPDATE ON serie_a_matches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
