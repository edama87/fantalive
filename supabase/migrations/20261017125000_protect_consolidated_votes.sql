-- Difesa a livello DB: le righe official_votes consolidate (pianetafanta) non
-- vengono mai sovrascritte dallo scraping fantacalcio.it. Lo scraping non manda
-- source né consolidated_at; un nuovo import pianetafanta manda un consolidated_at nuovo.
-- Un UPDATE che non è un nuovo import pianetafanta viene ignorato in silenzio
-- (RETURN NULL), così l'upsert del cron non fallisce per tutto il lotto.

CREATE OR REPLACE FUNCTION keep_consolidated_official_votes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF OLD.source = 'pianetafanta'
       AND (NEW.source IS DISTINCT FROM 'pianetafanta'
            OR NEW.consolidated_at IS NOT DISTINCT FROM OLD.consolidated_at) THEN
        RETURN NULL;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS official_votes_keep_consolidated ON official_votes;
CREATE TRIGGER official_votes_keep_consolidated
    BEFORE UPDATE ON official_votes
    FOR EACH ROW
    EXECUTE FUNCTION keep_consolidated_official_votes();
