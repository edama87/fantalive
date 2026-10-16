-- Voti ufficiali da fantacalcio.it: voto puro, fantavoto e bonus/malus.
-- vote_average include anche vote_fantacalcio, così una sola fonte produce la media.

ALTER TABLE official_votes
    ADD COLUMN IF NOT EXISTS vote_fantacalcio NUMERIC(3,1),
    ADD COLUMN IF NOT EXISTS fanta_vote NUMERIC(3,1),
    ADD COLUMN IF NOT EXISTS bonus_malus JSONB;

COMMENT ON COLUMN official_votes.vote_fantacalcio IS 'Voto puro visibile su fantacalcio.it (il numero mostrato in .player-grade)';
COMMENT ON COLUMN official_votes.fanta_vote IS 'Voto puro più bonus/malus delle icone (gol, assist, ammonizione, gol subito, ...)';
COMMENT ON COLUMN official_votes.bonus_malus IS 'Bonus e malus letti dalle icone della pagina voti';

ALTER TABLE official_votes DROP COLUMN IF EXISTS vote_average;

ALTER TABLE official_votes
    ADD COLUMN vote_average NUMERIC(4,2) GENERATED ALWAYS AS (
        COALESCE(
            (
                COALESCE(vote_gazzetta, 0) +
                COALESCE(vote_corriere, 0) +
                COALESCE(vote_tuttosport, 0) +
                COALESCE(vote_fantacalcio, 0)
            ) / NULLIF(
                (CASE WHEN vote_gazzetta IS NOT NULL THEN 1 ELSE 0 END) +
                (CASE WHEN vote_corriere IS NOT NULL THEN 1 ELSE 0 END) +
                (CASE WHEN vote_tuttosport IS NOT NULL THEN 1 ELSE 0 END) +
                (CASE WHEN vote_fantacalcio IS NOT NULL THEN 1 ELSE 0 END),
                0
            ),
            NULL
        )
    ) STORED;

COMMENT ON COLUMN official_votes.vote_average IS 'Media dei voti presenti (Gazzetta, Corriere, Tuttosport, Fantacalcio)';
