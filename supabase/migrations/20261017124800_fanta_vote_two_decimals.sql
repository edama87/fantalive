-- fanta_vote salvato con 2 decimali come la media consolidata (7,33 + 4 = 11,33,
-- non 11,3). Colonna informativa: il calcolo usa vote_average + bonus_malus.
ALTER TABLE official_votes ALTER COLUMN fanta_vote TYPE NUMERIC(4,2);

-- Ricalcolo delle righe consolidate già importate (media + bonus della riga).
UPDATE official_votes
SET fanta_vote = vote_average
    + 3 * COALESCE((SELECT SUM((b->>'count')::int) FROM jsonb_array_elements(bonus_malus) b WHERE b->>'type' = 'goal'), 0)
    + 2 * COALESCE((SELECT SUM((b->>'count')::int) FROM jsonb_array_elements(bonus_malus) b WHERE b->>'type' = 'penalty_scored'), 0)
    + 1 * COALESCE((SELECT SUM((b->>'count')::int) FROM jsonb_array_elements(bonus_malus) b WHERE b->>'type' = 'assist'), 0)
    + 3 * COALESCE((SELECT SUM((b->>'count')::int) FROM jsonb_array_elements(bonus_malus) b WHERE b->>'type' = 'penalty_saved'), 0)
    - 3 * COALESCE((SELECT SUM((b->>'count')::int) FROM jsonb_array_elements(bonus_malus) b WHERE b->>'type' = 'penalty_missed'), 0)
    - 1 * COALESCE((SELECT SUM((b->>'count')::int) FROM jsonb_array_elements(bonus_malus) b WHERE b->>'type' = 'own_goal'), 0)
    - 0.5 * COALESCE((SELECT SUM((b->>'count')::int) FROM jsonb_array_elements(bonus_malus) b WHERE b->>'type' = 'yellow_card'), 0)
    - 1 * COALESCE((SELECT SUM((b->>'count')::int) FROM jsonb_array_elements(bonus_malus) b WHERE b->>'type' = 'red_card'), 0)
    - 1 * COALESCE((SELECT SUM((b->>'count')::int) FROM jsonb_array_elements(bonus_malus) b WHERE b->>'type' = 'goal_conceded'), 0)
WHERE source = 'pianetafanta' AND vote_average IS NOT NULL AND jsonb_typeof(bonus_malus) = 'array';
