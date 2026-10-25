-- pianetafanta esporta 0 quando una testata non ha votato: 0 non è un voto.
-- vote_average ignora i voti di testata <= 0 (G 5,5 · CS s.v. · TS 0 = 5,5, non 2,75).
-- Ricrea la colonna generata: le righe esistenti vengono ricalcolate.
-- NB: fanta_vote delle righe già salvate va riscritto riapplicando la giornata
-- (Admin > Voti, o reapplyRoundVotes) dopo il deploy del codice corretto.

ALTER TABLE official_votes DROP COLUMN IF EXISTS vote_average;
ALTER TABLE official_votes
    ADD COLUMN vote_average NUMERIC(4,2) GENERATED ALWAYS AS (
        CASE
            WHEN vote_gazzetta > 0 OR vote_corriere > 0 OR vote_tuttosport > 0 THEN
                ROUND(
                    (COALESCE(NULLIF(GREATEST(vote_gazzetta, 0), 0), 0)
                     + COALESCE(NULLIF(GREATEST(vote_corriere, 0), 0), 0)
                     + COALESCE(NULLIF(GREATEST(vote_tuttosport, 0), 0), 0)) /
                    ((CASE WHEN vote_gazzetta > 0 THEN 1 ELSE 0 END) +
                     (CASE WHEN vote_corriere > 0 THEN 1 ELSE 0 END) +
                     (CASE WHEN vote_tuttosport > 0 THEN 1 ELSE 0 END)),
                    2
                )
            WHEN vote_fantacalcio > 0 THEN vote_fantacalcio
            ELSE NULL
        END
    ) STORED;

COMMENT ON COLUMN official_votes.vote_average IS 'Media dei voti di testata > 0 (Gazzetta, Corriere, Tuttosport); se nessuno, voto fantacalcio.it';
