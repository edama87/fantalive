-- Malus formazione non schierata: flag su lineups e persistenza nell'RPC di import.
-- Default false: G1–G6 restano invariate. Applicare in produzione solo dopo OK.

ALTER TABLE public.lineups
  ADD COLUMN IF NOT EXISTS not_submitted BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.lineups.not_submitted IS
  'True se la formazione non è stata depositata: ripresa l''ultima valida e malus −3 punti.';

CREATE OR REPLACE FUNCTION public.upsert_round_lineups(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  lineup_el jsonb;
  starter_el jsonb;
  bench_el jsonb;
  v_round integer;
  v_team_id text;
  v_formation text;
  v_lineup_id uuid;
  v_roster_version_id uuid;
  v_pos integer;
  v_player_id text;
  v_saved integer := 0;
  v_slots integer := 0;
  v_not_submitted boolean := false;
BEGIN
  v_round := (payload->>'roundNumber')::integer;
  IF v_round IS NULL THEN
    RAISE EXCEPTION 'roundNumber is required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM rounds WHERE number = v_round) THEN
    RAISE EXCEPTION 'Round % does not exist', v_round;
  END IF;

  IF jsonb_typeof(payload->'lineups') <> 'array' THEN
    RAISE EXCEPTION 'payload.lineups must be a JSON array';
  END IF;

  FOR lineup_el IN SELECT value FROM jsonb_array_elements(payload->'lineups')
  LOOP
    v_team_id := nullif(trim(lineup_el->>'teamId'), '');
    v_formation := nullif(trim(lineup_el->>'formation'), '');
    v_not_submitted := coalesce(
      (lineup_el->>'notSubmitted')::boolean,
      (lineup_el->>'usePreviousLineup')::boolean,
      false
    );

    IF v_team_id IS NULL OR v_formation IS NULL THEN
      RAISE EXCEPTION 'teamId and formation are required';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM teams WHERE id = v_team_id) THEN
      RAISE EXCEPTION 'Unknown team_id %', v_team_id;
    END IF;

    SELECT id INTO v_roster_version_id
    FROM roster_versions
    WHERE team_id = v_team_id
      AND effective_until IS NULL
    ORDER BY version_number DESC
    LIMIT 1;

    IF v_roster_version_id IS NULL THEN
      SELECT id INTO v_roster_version_id
      FROM roster_versions
      WHERE team_id = v_team_id
      ORDER BY version_number DESC
      LIMIT 1;
    END IF;

    IF v_roster_version_id IS NULL THEN
      RAISE EXCEPTION 'No roster version for team %', v_team_id;
    END IF;

    INSERT INTO lineups (
      team_id, round_number, roster_version_id, formation, submitted_at, is_auto_generated, not_submitted, updated_at
    ) VALUES (
      v_team_id, v_round, v_roster_version_id, v_formation, now(), v_not_submitted, v_not_submitted, now()
    )
    ON CONFLICT (team_id, round_number) DO UPDATE
      SET formation = EXCLUDED.formation,
          roster_version_id = EXCLUDED.roster_version_id,
          submitted_at = EXCLUDED.submitted_at,
          is_auto_generated = EXCLUDED.is_auto_generated,
          not_submitted = EXCLUDED.not_submitted,
          updated_at = now()
    RETURNING id INTO v_lineup_id;

    DELETE FROM lineup_slots WHERE lineup_id = v_lineup_id;

    v_pos := 0;
    FOR starter_el IN SELECT value FROM jsonb_array_elements(coalesce(lineup_el->'starters', '[]'::jsonb))
    LOOP
      IF jsonb_typeof(starter_el) = 'string' THEN
        v_player_id := starter_el#>>'{}';
      ELSE
        v_player_id := starter_el->>'playerId';
      END IF;
      IF v_player_id IS NULL OR v_player_id = '' THEN
        CONTINUE;
      END IF;
      INSERT INTO lineup_slots (lineup_id, player_id, slot_type, position)
      VALUES (v_lineup_id, v_player_id, 'starter', v_pos);
      v_pos := v_pos + 1;
      v_slots := v_slots + 1;
    END LOOP;

    v_pos := 0;
    FOR bench_el IN SELECT value FROM jsonb_array_elements(coalesce(lineup_el->'bench', '[]'::jsonb))
    LOOP
      IF jsonb_typeof(bench_el) = 'string' THEN
        v_player_id := bench_el#>>'{}';
      ELSE
        v_player_id := bench_el->>'playerId';
      END IF;
      IF v_player_id IS NULL OR v_player_id = '' THEN
        CONTINUE;
      END IF;
      INSERT INTO lineup_slots (lineup_id, player_id, slot_type, position)
      VALUES (v_lineup_id, v_player_id, 'bench', v_pos)
      ON CONFLICT (lineup_id, player_id) DO NOTHING;
      v_pos := v_pos + 1;
      v_slots := v_slots + 1;
    END LOOP;

    v_saved := v_saved + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'roundNumber', v_round,
    'lineupsSaved', v_saved,
    'slotsSaved', v_slots,
    'lineupsInDb', (SELECT count(*) FROM lineups WHERE round_number = v_round),
    'slotsInDb', (
      SELECT count(*)
      FROM lineup_slots ls
      JOIN lineups l ON l.id = ls.lineup_id
      WHERE l.round_number = v_round
    )
  );
END;
$$;


REVOKE ALL ON FUNCTION public.upsert_round_lineups(jsonb) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.upsert_round_lineups(jsonb) FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.upsert_round_lineups(jsonb) FROM authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.upsert_round_lineups(jsonb) TO service_role';
  ELSE
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.upsert_round_lineups(jsonb) TO CURRENT_USER';
  END IF;
END $$;
