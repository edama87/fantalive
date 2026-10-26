-- Voti ufficiali importati da FMS Revo (Admin > Quadratura > "Importa voti FMS").
-- source 'fms' = voto e bonus/malus come li ha calcolati FMS: prevalgono su
-- pianetafanta e fantacalcio.it. vote_fms ha 3 decimali (FMS fa la media delle
-- testate, es. 6,333); fms_bonus è il totale bonus/malus FMS (fantavoto = voto + bonus).
-- previous_row conserva la riga sostituita, così l'import è annullabile.
-- NON applicata in prod finché Daniele non la approva.

ALTER TABLE official_votes
    ADD COLUMN IF NOT EXISTS vote_fms NUMERIC(5,3),
    ADD COLUMN IF NOT EXISTS fms_bonus NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS previous_row JSONB;

ALTER TABLE official_votes DROP CONSTRAINT IF EXISTS official_votes_source_check;
ALTER TABLE official_votes
    ADD CONSTRAINT official_votes_source_check CHECK (source IN ('fantacalcio', 'pianetafanta', 'fms'));

COMMENT ON COLUMN official_votes.vote_fms IS 'Voto FMS Revo (3 decimali); null = s.v. FMS';
COMMENT ON COLUMN official_votes.fms_bonus IS 'Totale bonus/malus FMS Revo';
COMMENT ON COLUMN official_votes.previous_row IS 'Riga official_votes sostituita dall''import FMS (per annullarlo)';

-- Le righe 'fms' non vengono sovrascritte né dallo scraping fantacalcio.it né da
-- un import pianetafanta; si tolgono solo con l'annullamento (DELETE + reinsert).
-- Un import FMS può invece sostituire una riga pianetafanta.
CREATE OR REPLACE FUNCTION keep_consolidated_official_votes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF OLD.source = 'fms'
       AND (NEW.source IS DISTINCT FROM 'fms'
            OR NEW.consolidated_at IS NOT DISTINCT FROM OLD.consolidated_at) THEN
        RETURN NULL;
    END IF;
    IF OLD.source = 'pianetafanta'
       AND NEW.source IS DISTINCT FROM 'fms'
       AND (NEW.source IS DISTINCT FROM 'pianetafanta'
            OR NEW.consolidated_at IS NOT DISTINCT FROM OLD.consolidated_at) THEN
        RETURN NULL;
    END IF;
    RETURN NEW;
END;
$$;
