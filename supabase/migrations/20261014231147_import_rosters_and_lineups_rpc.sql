-- RPC for atomic FMS roster import and round lineup upsert.
-- Invoked with service_role key only (RLS bypass via invoker=service_role).

CREATE UNIQUE INDEX IF NOT EXISTS idx_players_fms_identity
  ON players (name, role, (COALESCE(real_team, '')));

CREATE OR REPLACE FUNCTION public.slugify_label(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(both '-' FROM regexp_replace(lower(coalesce(input, '')), '[^a-z0-9]+', '-', 'g'));
$$;

CREATE OR REPLACE FUNCTION public.import_fms_rosters(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  team_el jsonb;
  player_el jsonb;
  v_team_id text;
  v_team_name text;
  v_manager text;
  v_player_id text;
  v_player_name text;
  v_role text;
  v_real_team text;
  v_version_id uuid;
  v_version_number integer;
  v_now timestamptz := now();
  v_imported_player_ids text[] := ARRAY[]::text[];
  v_team_count integer;
  v_active_players integer;
  v_inactive_players integer;
  v_roster_players integer;
  v_teams_detail jsonb := '[]'::jsonb;
  v_detail_count integer;
BEGIN
  IF payload IS NULL OR jsonb_typeof(payload->'teams') <> 'array' THEN
    RAISE EXCEPTION 'payload.teams must be a JSON array';
  END IF;

  FOR team_el IN SELECT value FROM jsonb_array_elements(payload->'teams')
  LOOP
    v_team_name := nullif(trim(team_el->>'teamName'), '');
    IF v_team_name IS NULL THEN
      RAISE EXCEPTION 'teamName is required';
    END IF;

    v_manager := coalesce(nullif(trim(team_el->>'managerName'), ''), 'TBD');

    SELECT id INTO v_team_id
    FROM teams
    WHERE lower(name) = lower(v_team_name)
    LIMIT 1;

    IF v_team_id IS NULL THEN
      v_team_id := left(public.slugify_label(v_team_name), 32);
      IF v_team_id IS NULL OR v_team_id = '' THEN
        v_team_id := 'team-' || substr(md5(v_team_name), 1, 8);
      END IF;
      -- Avoid collision with existing ids
      IF EXISTS (SELECT 1 FROM teams WHERE id = v_team_id) THEN
        v_team_id := v_team_id || '-' || substr(md5(v_team_name), 1, 4);
      END IF;

      INSERT INTO teams (id, name, manager_name, updated_at)
      VALUES (v_team_id, v_team_name, v_manager, v_now);
    ELSE
      UPDATE teams
      SET name = v_team_name,
          updated_at = v_now
      WHERE id = v_team_id;
    END IF;

    -- Current open roster version (or create one)
    SELECT id, version_number
      INTO v_version_id, v_version_number
    FROM roster_versions
    WHERE team_id = v_team_id
      AND effective_until IS NULL
    ORDER BY version_number DESC
    LIMIT 1;

    IF v_version_id IS NULL THEN
      SELECT coalesce(max(version_number), 0) + 1
        INTO v_version_number
      FROM roster_versions
      WHERE team_id = v_team_id;

      INSERT INTO roster_versions (
        team_id, version_number, effective_from, credits_remaining, market_credits, notes
      ) VALUES (
        v_team_id, v_version_number, v_now, 0, 60, 'Imported from FMS Revo'
      )
      RETURNING id INTO v_version_id;
    ELSE
      UPDATE roster_versions
      SET notes = 'Imported from FMS Revo',
          effective_from = least(effective_from, v_now)
      WHERE id = v_version_id;
    END IF;

    DELETE FROM roster_players WHERE roster_version_id = v_version_id;

    FOR player_el IN SELECT value FROM jsonb_array_elements(coalesce(team_el->'players', '[]'::jsonb))
    LOOP
      v_player_name := nullif(trim(player_el->>'name'), '');
      v_role := upper(nullif(trim(player_el->>'role'), ''));
      v_real_team := nullif(trim(player_el->>'realTeam'), '');

      IF v_player_name IS NULL OR v_role IS NULL OR v_role NOT IN ('P', 'D', 'C', 'A') THEN
        RAISE EXCEPTION 'Invalid player in team %: name/role required', v_team_name;
      END IF;

      SELECT id INTO v_player_id
      FROM players
      WHERE name = v_player_name
        AND role = v_role
        AND coalesce(real_team, '') = coalesce(v_real_team, '')
      LIMIT 1;

      IF v_player_id IS NULL THEN
        v_player_id := left(public.slugify_label(v_player_name) || '-' || lower(v_role), 64);
        IF v_player_id IS NULL OR v_player_id = '' OR EXISTS (SELECT 1 FROM players WHERE id = v_player_id) THEN
          v_player_id := 'fms-' || substr(md5(v_player_name || '|' || v_role || '|' || coalesce(v_real_team, '')), 1, 16);
        END IF;

        INSERT INTO players (id, name, role, real_team, is_active, auction_price, updated_at)
        VALUES (
          v_player_id,
          v_player_name,
          v_role,
          v_real_team,
          true,
          NULLIF(player_el->>'price', '')::integer,
          v_now
        );
      ELSE
        UPDATE players
        SET name = v_player_name,
            role = v_role,
            real_team = v_real_team,
            is_active = true,
            auction_price = COALESCE(NULLIF(player_el->>'price', '')::integer, auction_price),
            updated_at = v_now
        WHERE id = v_player_id;
      END IF;

      INSERT INTO roster_players (
        roster_version_id, player_id, acquisition_type, acquisition_price, acquired_at
      ) VALUES (
        v_version_id,
        v_player_id,
        'initial',
        COALESCE(NULLIF(player_el->>'price', '')::integer, 0),
        v_now
      )
      ON CONFLICT (roster_version_id, player_id) DO NOTHING;

      v_imported_player_ids := array_append(v_imported_player_ids, v_player_id);
    END LOOP;

    SELECT count(*) INTO v_detail_count
    FROM roster_players
    WHERE roster_version_id = v_version_id;

    v_teams_detail := v_teams_detail || jsonb_build_array(jsonb_build_object(
      'teamId', v_team_id,
      'teamName', v_team_name,
      'rosterVersionId', v_version_id,
      'playerCount', v_detail_count
    ));
  END LOOP;

  -- Activate only players currently on at least one roster
  UPDATE players
  SET is_active = false,
      updated_at = v_now
  WHERE id NOT IN (SELECT DISTINCT player_id FROM roster_players);

  UPDATE players
  SET is_active = true,
      updated_at = v_now
  WHERE id IN (SELECT DISTINCT player_id FROM roster_players);

  SELECT count(*) INTO v_team_count FROM teams;
  SELECT count(*) INTO v_active_players FROM players WHERE is_active = true;
  SELECT count(*) INTO v_inactive_players FROM players WHERE is_active = false;
  SELECT count(*) INTO v_roster_players FROM roster_players;

  RETURN jsonb_build_object(
    'teams', v_team_count,
    'playersActive', v_active_players,
    'playersInactive', v_inactive_players,
    'rosterPlayers', v_roster_players,
    'importedTeams', jsonb_array_length(payload->'teams'),
    'teamsDetail', v_teams_detail
  );
END;
$$;

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
      team_id, round_number, roster_version_id, formation, submitted_at, is_auto_generated, updated_at
    ) VALUES (
      v_team_id, v_round, v_roster_version_id, v_formation, now(), false, now()
    )
    ON CONFLICT (team_id, round_number) DO UPDATE
      SET formation = EXCLUDED.formation,
          roster_version_id = EXCLUDED.roster_version_id,
          submitted_at = EXCLUDED.submitted_at,
          is_auto_generated = false,
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

REVOKE ALL ON FUNCTION public.import_fms_rosters(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_round_lineups(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.slugify_label(text) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.import_fms_rosters(jsonb) FROM anon';
    EXECUTE 'REVOKE ALL ON FUNCTION public.upsert_round_lineups(jsonb) FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.import_fms_rosters(jsonb) FROM authenticated';
    EXECUTE 'REVOKE ALL ON FUNCTION public.upsert_round_lineups(jsonb) FROM authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.import_fms_rosters(jsonb) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.upsert_round_lineups(jsonb) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.slugify_label(text) TO service_role';
  ELSE
    -- Local/dev Postgres without Supabase roles: allow current DB owner
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.import_fms_rosters(jsonb) TO CURRENT_USER';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.upsert_round_lineups(jsonb) TO CURRENT_USER';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.slugify_label(text) TO CURRENT_USER';
  END IF;
END $$;
