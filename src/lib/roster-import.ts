/**
 * FMS roster import helpers: payload shaping + Supabase write
 * (RPC when available, otherwise service-client path).
 */

import { createHash } from 'node:crypto';
import type { ParsedTeamRoster } from '@/lib/fmsrevo-roster-parser';
import { getServerClient, isSupabaseServerConfigured } from '@/lib/db/supabase';

export interface ImportRostersCounts {
  teams: number;
  playersActive: number;
  playersInactive: number;
  rosterPlayers: number;
  importedTeams: number;
  teamsDetail: Array<{
    teamId: string;
    teamName: string;
    rosterVersionId: string;
    playerCount: number;
  }>;
  mode?: 'rpc' | 'service';
}

export function buildImportRostersPayload(teams: ParsedTeamRoster[]) {
  return {
    teams: teams.map((team) => ({
      teamName: team.teamName,
      managerName: 'TBD',
      players: team.players.map((p) => ({
        name: p.name,
        role: p.role,
        realTeam: p.realTeam,
        price: p.price ?? null,
      })),
    })),
  };
}

function slugifyLabel(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function md5Short(value: string, len: number): string {
  return createHash('md5').update(value).digest('hex').slice(0, len);
}

function assertOk<T extends { error: { message: string } | null }>(
  res: T,
  context: string
): asserts res is T & { error: null } {
  if (res.error) {
    throw new Error(`${context}: ${res.error.message}`);
  }
}

export async function importRostersViaServiceClient(
  teams: ParsedTeamRoster[]
): Promise<ImportRostersCounts> {
  if (!isSupabaseServerConfigured()) {
    throw new Error(
      'SUPABASE_SECRET_KEY non configurata: impossibile scrivere su Supabase'
    );
  }

  const supabase = getServerClient();
  const now = new Date().toISOString();
  const teamsDetail: ImportRostersCounts['teamsDetail'] = [];
  const rosteredPlayerIds = new Set<string>();

  for (const team of teams) {
    const teamName = team.teamName.trim();
    if (!teamName) throw new Error('teamName is required');

    const { data: existingTeams, error: teamLookupError } = await supabase
      .from('teams')
      .select('id, name')
      .ilike('name', teamName);

    assertOk({ error: teamLookupError }, 'team lookup');

    let teamId =
      existingTeams?.find((t) => t.name.toLowerCase() === teamName.toLowerCase())
        ?.id ?? null;

    if (!teamId) {
      teamId = slugifyLabel(teamName).slice(0, 32) || `team-${md5Short(teamName, 8)}`;
      const { data: idClash } = await supabase
        .from('teams')
        .select('id')
        .eq('id', teamId)
        .maybeSingle();
      if (idClash?.id) {
        teamId = `${teamId}-${md5Short(teamName, 4)}`;
      }
      const insert = await supabase.from('teams').insert({
        id: teamId,
        name: teamName,
        manager_name: 'TBD',
        updated_at: now,
      });
      assertOk(insert, `insert team ${teamName}`);
    } else {
      const update = await supabase
        .from('teams')
        .update({ name: teamName, updated_at: now })
        .eq('id', teamId);
      assertOk(update, `update team ${teamName}`);
    }

    const { data: openVersions, error: versionError } = await supabase
      .from('roster_versions')
      .select('id, version_number, effective_from')
      .eq('team_id', teamId)
      .is('effective_until', null)
      .order('version_number', { ascending: false })
      .limit(1);

    assertOk({ error: versionError }, `roster version ${teamId}`);

    let versionId = openVersions?.[0]?.id as string | undefined;
    if (!versionId) {
      const { data: maxRows } = await supabase
        .from('roster_versions')
        .select('version_number')
        .eq('team_id', teamId)
        .order('version_number', { ascending: false })
        .limit(1);
      const nextVersion = (maxRows?.[0]?.version_number ?? 0) + 1;
      const created = await supabase
        .from('roster_versions')
        .insert({
          team_id: teamId,
          version_number: nextVersion,
          effective_from: now,
          credits_remaining: 0,
          market_credits: 60,
          notes: 'Imported from FMS Revo',
        })
        .select('id')
        .single();
      assertOk(created, `create roster version ${teamId}`);
      versionId = created.data!.id;
    } else {
      const patch = await supabase
        .from('roster_versions')
        .update({ notes: 'Imported from FMS Revo' })
        .eq('id', versionId);
      assertOk(patch, `patch roster version ${teamId}`);
    }

    const clear = await supabase
      .from('roster_players')
      .delete()
      .eq('roster_version_id', versionId);
    assertOk(clear, `clear roster ${teamId}`);

    for (const player of team.players) {
      const playerName = player.name.trim();
      const role = player.role;
      const realTeam = player.realTeam?.trim() || null;
      if (!playerName || !role) {
        throw new Error(`Invalid player in team ${teamName}`);
      }

      let query = supabase
        .from('players')
        .select('id')
        .eq('name', playerName)
        .eq('role', role);
      query = realTeam
        ? query.eq('real_team', realTeam)
        : query.is('real_team', null);

      const { data: matches, error: playerLookupError } = await query.limit(1);
      assertOk({ error: playerLookupError }, `player lookup ${playerName}`);

      let playerId = matches?.[0]?.id as string | undefined;
      const price = player.price ?? null;

      if (!playerId) {
        playerId = `${slugifyLabel(playerName)}-${role.toLowerCase()}`.slice(0, 64);
        if (!playerId || playerId === `-${role.toLowerCase()}`) {
          playerId = `fms-${md5Short(`${playerName}|${role}|${realTeam || ''}`, 16)}`;
        } else {
          const { data: clash } = await supabase
            .from('players')
            .select('id')
            .eq('id', playerId)
            .maybeSingle();
          if (clash?.id) {
            playerId = `fms-${md5Short(`${playerName}|${role}|${realTeam || ''}`, 16)}`;
          }
        }

        const inserted = await supabase.from('players').insert({
          id: playerId,
          name: playerName,
          role,
          real_team: realTeam,
          is_active: true,
          auction_price: price,
          updated_at: now,
        });
        assertOk(inserted, `insert player ${playerName}`);
      } else {
        const updated = await supabase
          .from('players')
          .update({
            name: playerName,
            role,
            real_team: realTeam,
            is_active: true,
            auction_price: price,
            updated_at: now,
          })
          .eq('id', playerId);
        assertOk(updated, `update player ${playerName}`);
      }

      const link = await supabase.from('roster_players').upsert(
        {
          roster_version_id: versionId,
          player_id: playerId,
          acquisition_type: 'initial',
          acquisition_price: price ?? 0,
          acquired_at: now,
        },
        { onConflict: 'roster_version_id,player_id' }
      );
      assertOk(link, `link player ${playerName}`);
      rosteredPlayerIds.add(playerId);
    }

    const { count: playerCount, error: countError } = await supabase
      .from('roster_players')
      .select('*', { count: 'exact', head: true })
      .eq('roster_version_id', versionId);
    assertOk({ error: countError }, `count roster ${teamId}`);

    teamsDetail.push({
      teamId,
      teamName,
      rosterVersionId: versionId,
      playerCount: playerCount ?? 0,
    });
  }

  // Also include players already on other roster versions that we didn't touch
  const { data: allRostered, error: allRosteredError } = await supabase
    .from('roster_players')
    .select('player_id');
  assertOk({ error: allRosteredError }, 'list rostered players');
  for (const row of allRostered || []) {
    rosteredPlayerIds.add(row.player_id);
  }

  const rosteredList = Array.from(rosteredPlayerIds);

  if (rosteredList.length > 0) {
    const activate = await supabase
      .from('players')
      .update({ is_active: true, updated_at: now })
      .in('id', rosteredList);
    assertOk(activate, 'activate rostered players');
  }

  // Deactivate players not on any roster (chunked to avoid URL limits)
  const { data: allPlayers, error: allPlayersError } = await supabase
    .from('players')
    .select('id');
  assertOk({ error: allPlayersError }, 'list all players');
  const toDeactivate = (allPlayers || [])
    .map((p) => p.id)
    .filter((id) => !rosteredPlayerIds.has(id));

  for (let i = 0; i < toDeactivate.length; i += 100) {
    const chunk = toDeactivate.slice(i, i + 100);
    if (chunk.length === 0) continue;
    const deactivate = await supabase
      .from('players')
      .update({ is_active: false, updated_at: now })
      .in('id', chunk);
    assertOk(deactivate, 'deactivate orphan players');
  }

  const verified = await readRosterDbCounts();
  return {
    teams: verified.teams,
    playersActive: verified.playersActive,
    playersInactive: verified.playersInactive,
    rosterPlayers: verified.rosterPlayers,
    importedTeams: teams.length,
    teamsDetail,
    mode: 'service',
  };
}

export async function importRostersViaRpc(
  teams: ParsedTeamRoster[]
): Promise<ImportRostersCounts> {
  if (!isSupabaseServerConfigured()) {
    throw new Error(
      'SUPABASE_SECRET_KEY non configurata: impossibile scrivere su Supabase'
    );
  }

  const supabase = getServerClient();
  const payload = buildImportRostersPayload(teams);

  const { data, error } = await supabase.rpc('import_fms_rosters', { payload });

  if (error) {
    const missing =
      error.message.includes('Could not find the function') ||
      error.code === 'PGRST202';
    if (missing) {
      return importRostersViaServiceClient(teams);
    }
    throw new Error(`import_fms_rosters failed: ${error.message}`);
  }

  return { ...(data as ImportRostersCounts), mode: 'rpc' };
}

export async function readRosterDbCounts(): Promise<{
  teams: number;
  playersActive: number;
  playersInactive: number;
  rosterPlayers: number;
}> {
  const supabase = getServerClient();

  const [teams, active, inactive, rosterPlayers] = await Promise.all([
    supabase.from('teams').select('*', { count: 'exact', head: true }),
    supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true),
    supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', false),
    supabase.from('roster_players').select('*', { count: 'exact', head: true }),
  ]);

  for (const res of [teams, active, inactive, rosterPlayers]) {
    if (res.error) throw new Error(res.error.message);
  }

  return {
    teams: teams.count ?? 0,
    playersActive: active.count ?? 0,
    playersInactive: inactive.count ?? 0,
    rosterPlayers: rosterPlayers.count ?? 0,
  };
}
