-- Harden FMS roster import: open roster = exactly imported FMS players;
-- deactivate anyone not on an open roster. One-shot cleanup for seed leftovers.

CREATE OR REPLACE FUNCTION public.is_seed_player_id(player_id text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT player_id ~ '^(ym|am|fc|sf|rp|psg|le|st|ap|dc)-';
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
  v_team_imported_ids text[];
  v_team_count integer;
  v_active_players integer;
  v_inactive_players integer;
  v_roster_players integer;
  v_teams_detail jsonb := '[]'::jsonb;
  v_detail_count integer;
  v_expected_count integer;
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
    v_team_imported_ids := ARRAY[]::text[];

    SELECT id INTO v_team_id
    FROM teams
    WHERE lower(name) = lower(v_team_name)
    LIMIT 1;

    IF v_team_id IS NULL THEN
      v_team_id := left(public.slugify_label(v_team_name), 32);
      IF v_team_id IS NULL OR v_team_id = '' THEN
        v_team_id := 'team-' || substr(md5(v_team_name), 1, 8);
      END IF;
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

      -- Never reuse seed/test player rows for FMS imports
      SELECT id INTO v_player_id
      FROM players
      WHERE name = v_player_name
        AND role = v_role
        AND coalesce(real_team, '') = coalesce(v_real_team, '')
        AND NOT public.is_seed_player_id(id)
      LIMIT 1;

      IF v_player_id IS NULL THEN
        v_player_id := left(public.slugify_label(v_player_name) || '-' || lower(v_role), 64);
        IF v_player_id IS NULL OR v_player_id = ''
           OR public.is_seed_player_id(v_player_id)
           OR EXISTS (SELECT 1 FROM players WHERE id = v_player_id) THEN
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
        )
        ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name,
            role = EXCLUDED.role,
            real_team = EXCLUDED.real_team,
            is_active = true,
            auction_price = COALESCE(EXCLUDED.auction_price, players.auction_price),
            updated_at = v_now;
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

      v_team_imported_ids := array_append(v_team_imported_ids, v_player_id);
      v_imported_player_ids := array_append(v_imported_player_ids, v_player_id);
    END LOOP;

    -- Drop any leftover rows that are not part of this FMS import
    DELETE FROM roster_players
    WHERE roster_version_id = v_version_id
      AND NOT (player_id = ANY (v_team_imported_ids));

    v_expected_count := jsonb_array_length(coalesce(team_el->'players', '[]'::jsonb));

    SELECT count(*) INTO v_detail_count
    FROM roster_players
    WHERE roster_version_id = v_version_id;

    IF v_detail_count <> v_expected_count THEN
      RAISE EXCEPTION
        'Open roster for % has % players after import (expected %)',
        v_team_name, v_detail_count, v_expected_count;
    END IF;

    v_teams_detail := v_teams_detail || jsonb_build_array(jsonb_build_object(
      'teamId', v_team_id,
      'teamName', v_team_name,
      'rosterVersionId', v_version_id,
      'playerCount', v_detail_count
    ));
  END LOOP;

  -- Active = only players on at least one OPEN roster
  UPDATE players
  SET is_active = false,
      updated_at = v_now
  WHERE id NOT IN (
    SELECT DISTINCT rp.player_id
    FROM roster_players rp
    JOIN roster_versions rv ON rv.id = rp.roster_version_id
    WHERE rv.effective_until IS NULL
  );

  UPDATE players
  SET is_active = true,
      updated_at = v_now
  WHERE id IN (
    SELECT DISTINCT rp.player_id
    FROM roster_players rp
    JOIN roster_versions rv ON rv.id = rp.roster_version_id
    WHERE rv.effective_until IS NULL
  );

  SELECT count(*) INTO v_team_count FROM teams;
  SELECT count(*) INTO v_active_players FROM players WHERE is_active = true;
  SELECT count(*) INTO v_inactive_players FROM players WHERE is_active = false;
  SELECT count(*) INTO v_roster_players
  FROM roster_players rp
  JOIN roster_versions rv ON rv.id = rp.roster_version_id
  WHERE rv.effective_until IS NULL;

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

-- One-shot cleanup: purge seed players from open rosters and deactivate orphans
CREATE OR REPLACE FUNCTION public.cleanup_seed_players_from_open_rosters()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_removed integer;
  v_deactivated integer;
  v_active integer;
  v_open_roster integer;
BEGIN
  DELETE FROM roster_players rp
  USING roster_versions rv
  WHERE rp.roster_version_id = rv.id
    AND rv.effective_until IS NULL
    AND public.is_seed_player_id(rp.player_id);

  GET DIAGNOSTICS v_removed = ROW_COUNT;

  UPDATE players
  SET is_active = false,
      updated_at = v_now
  WHERE id NOT IN (
    SELECT DISTINCT rp.player_id
    FROM roster_players rp
    JOIN roster_versions rv ON rv.id = rp.roster_version_id
    WHERE rv.effective_until IS NULL
  );

  GET DIAGNOSTICS v_deactivated = ROW_COUNT;

  UPDATE players
  SET is_active = true,
      updated_at = v_now
  WHERE id IN (
    SELECT DISTINCT rp.player_id
    FROM roster_players rp
    JOIN roster_versions rv ON rv.id = rp.roster_version_id
    WHERE rv.effective_until IS NULL
  );

  SELECT count(*) INTO v_active FROM players WHERE is_active = true;
  SELECT count(*) INTO v_open_roster
  FROM roster_players rp
  JOIN roster_versions rv ON rv.id = rp.roster_version_id
  WHERE rv.effective_until IS NULL;

  RETURN jsonb_build_object(
    'seedRemovedFromOpenRosters', v_removed,
    'playersDeactivated', v_deactivated,
    'playersActive', v_active,
    'openRosterPlayers', v_open_roster
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_seed_players_from_open_rosters() FROM PUBLIC;
DO $$
BEGIN
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.cleanup_seed_players_from_open_rosters() FROM anon';
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  BEGIN
    EXECUTE 'REVOKE ALL ON FUNCTION public.cleanup_seed_players_from_open_rosters() FROM authenticated';
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  BEGIN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.cleanup_seed_players_from_open_rosters() TO service_role';
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  BEGIN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.cleanup_seed_players_from_open_rosters() TO CURRENT_USER';
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
END $$;
