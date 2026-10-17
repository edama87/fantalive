-- Voti consolidati da pianetafanta (export Excel caricato dall'admin).
-- source distingue la provenienza della riga: 'fantacalcio' (scraping
-- fantacalcio.it, provvisorio) o 'pianetafanta' (Gazzetta/Corriere/Tuttosport,
-- consolidato). Una riga pianetafanta ha la precedenza e non viene più
-- sovrascritta dallo scraping fantacalcio.it.

ALTER TABLE official_votes
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'fantacalcio',
    ADD COLUMN IF NOT EXISTS consolidated_at TIMESTAMPTZ;

ALTER TABLE official_votes
    ADD CONSTRAINT official_votes_source_check CHECK (source IN ('fantacalcio', 'pianetafanta'));

COMMENT ON COLUMN official_votes.source IS 'fantacalcio = voto fantacalcio.it (provvisorio); pianetafanta = Gazzetta/Corriere/Tuttosport (consolidato)';
COMMENT ON COLUMN official_votes.consolidated_at IS 'Quando la riga è stata consolidata con i voti pianetafanta';

-- Media: se c'è almeno un voto di testata (G/CS/TS) solo quelli, altrimenti
-- il voto fantacalcio.it. Così una riga pianetafanta non mescola le fonti.
ALTER TABLE official_votes DROP COLUMN IF EXISTS vote_average;
ALTER TABLE official_votes
    ADD COLUMN vote_average NUMERIC(4,2) GENERATED ALWAYS AS (
        CASE
            WHEN vote_gazzetta IS NOT NULL OR vote_corriere IS NOT NULL OR vote_tuttosport IS NOT NULL THEN
                ROUND(
                    (COALESCE(vote_gazzetta, 0) + COALESCE(vote_corriere, 0) + COALESCE(vote_tuttosport, 0)) /
                    ((CASE WHEN vote_gazzetta IS NOT NULL THEN 1 ELSE 0 END) +
                     (CASE WHEN vote_corriere IS NOT NULL THEN 1 ELSE 0 END) +
                     (CASE WHEN vote_tuttosport IS NOT NULL THEN 1 ELSE 0 END)),
                    2
                )
            ELSE vote_fantacalcio
        END
    ) STORED;

COMMENT ON COLUMN official_votes.vote_average IS 'Media dei voti di testata presenti (Gazzetta, Corriere, Tuttosport); se nessuno, voto fantacalcio.it';

-- Import pianetafanta per partita: tutti i giocatori del file (anche quelli
-- non in rosa), per il dettaglio Serie A e come traccia dell'import.
CREATE TABLE IF NOT EXISTS official_vote_imports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    round_number INTEGER NOT NULL REFERENCES rounds(number),
    serie_a_matchday INTEGER NOT NULL,
    source TEXT NOT NULL DEFAULT 'pianetafanta',
    match_key TEXT NOT NULL,
    home_team TEXT NOT NULL,
    away_team TEXT,
    players JSONB NOT NULL,
    matched_count INTEGER NOT NULL DEFAULT 0,
    unmatched_count INTEGER NOT NULL DEFAULT 0,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (round_number, source, match_key)
);

ALTER TABLE official_vote_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "official_vote_imports_select_public" ON official_vote_imports FOR SELECT USING (true);
