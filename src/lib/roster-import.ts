/**
 * FMS roster import helpers: payload shaping + Supabase write
 * (RPC when available, otherwise service-client path).
 */

import { createHash } from 'node:crypto';
import type { ParsedTeamRoster } from '@/lib/fmsrevo-roster-parser';
import { getServerClient, isSupabaseServerConfigured } from '@/lib/db/supabase';
import {
  buildPlayerAliasInsert,
  FMS_ALIAS_SOURCE,
  type FmsPlayerAlias,
  type LineupPlayerCatalogEntry,
} from '@/lib/lineup-matching';
import type { Player, PlayerRole } from '@/types';

/** Seed/test player ids from 00003_seed_data.sql (e.g. ym-meret). */
const SEED_PLAYER_ID_RE = /^(ym|am|fc|sf|rp|psg|le|st|ap|dc)-/;

export function isSeedPlayerId(playerId: string): boolean {
  return SEED_PLAYER_ID_RE.test(playerId);
}

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

export interface CleanupOpenRostersResult {
  seedRemovedFromOpenRosters: number;
  playersDeactivated: number;
  playersActive: number;
  openRosterPlayers: number;
  teamsDetail: Array<{
    teamId: string;
    teamName: string;
    openRosterCount: number;
  }>;
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

  for (const team of teams) {
    const teamName = team.teamName.trim();
    if (!teamName) throw new Error('teamName is required');
    const teamImportedIds = new Set<string>();

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
    if (!versionId) {
      throw new Error(`Versione rosa non creata per ${teamName}`);
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

      const { data: matches, error: playerLookupError } = await query.limit(10);
      assertOk({ error: playerLookupError }, `player lookup ${playerName}`);

      // Never reuse seed/test rows for FMS roster links
      let playerId = matches?.find((m) => !isSeedPlayerId(m.id))?.id as
        | string
        | undefined;
      const price = player.price ?? null;

      if (!playerId) {
        playerId = `${slugifyLabel(playerName)}-${role.toLowerCase()}`.slice(0, 64);
        if (
          !playerId ||
          playerId === `-${role.toLowerCase()}` ||
          isSeedPlayerId(playerId)
        ) {
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

      const link: { error: { message: string } | null } = await supabase
        .from('roster_players')
        .upsert(
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
      teamImportedIds.add(playerId);
    }

    // Drop leftovers not in this FMS import (seed or stale)
    const { data: linkedRows, error: linkedError } = await supabase
      .from('roster_players')
      .select('player_id')
      .eq('roster_version_id', versionId);
    assertOk({ error: linkedError }, `list linked ${teamId}`);
    const staleIds = (linkedRows || [])
      .map((r) => r.player_id)
      .filter((id) => !teamImportedIds.has(id));
    if (staleIds.length > 0) {
      const dropStale = await supabase
        .from('roster_players')
        .delete()
        .eq('roster_version_id', versionId)
        .in('player_id', staleIds);
      assertOk(dropStale, `drop stale roster ${teamId}`);
    }

    const { count: playerCount, error: countError } = await supabase
      .from('roster_players')
      .select('*', { count: 'exact', head: true })
      .eq('roster_version_id', versionId);
    assertOk({ error: countError }, `count roster ${teamId}`);

    if ((playerCount ?? 0) !== team.players.length) {
      throw new Error(
        `Open roster for ${teamName} has ${playerCount} players after import (expected ${team.players.length})`
      );
    }

    teamsDetail.push({
      teamId,
      teamName,
      rosterVersionId: versionId,
      playerCount: playerCount ?? 0,
    });
  }

  await reconcilePlayerActiveFlags(now);

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

async function listOpenRosterPlayerIds(): Promise<Set<string>> {
  const supabase = getServerClient();
  const { data: openVersions, error: openError } = await supabase
    .from('roster_versions')
    .select('id')
    .is('effective_until', null);
  assertOk({ error: openError }, 'list open roster versions');

  const openIds = (openVersions || []).map((v) => v.id);
  const rostered = new Set<string>();
  if (openIds.length === 0) return rostered;

  for (let i = 0; i < openIds.length; i += 50) {
    const chunk = openIds.slice(i, i + 50);
    const { data, error } = await supabase
      .from('roster_players')
      .select('player_id')
      .in('roster_version_id', chunk);
    assertOk({ error }, 'list open roster players');
    for (const row of data || []) {
      rostered.add(row.player_id);
    }
  }
  return rostered;
}

async function reconcilePlayerActiveFlags(now = new Date().toISOString()) {
  const supabase = getServerClient();
  const openRostered = await listOpenRosterPlayerIds();

  const { data: allPlayers, error: allPlayersError } = await supabase
    .from('players')
    .select('id, is_active');
  assertOk({ error: allPlayersError }, 'list all players');

  const toActivate: string[] = [];
  const toDeactivate: string[] = [];
  for (const p of allPlayers || []) {
    const shouldBeActive = openRostered.has(p.id);
    if (shouldBeActive && !p.is_active) toActivate.push(p.id);
    if (!shouldBeActive && p.is_active) toDeactivate.push(p.id);
  }

  for (let i = 0; i < toActivate.length; i += 100) {
    const chunk = toActivate.slice(i, i + 100);
    const res = await supabase
      .from('players')
      .update({ is_active: true, updated_at: now })
      .in('id', chunk);
    assertOk(res, 'activate open-roster players');
  }

  for (let i = 0; i < toDeactivate.length; i += 100) {
    const chunk = toDeactivate.slice(i, i + 100);
    const res = await supabase
      .from('players')
      .update({ is_active: false, updated_at: now })
      .in('id', chunk);
    assertOk(res, 'deactivate non-roster players');
  }
}

/**
 * One-shot cleanup: remove seed/test players from open rosters and
 * set is_active=false for anyone not on an open roster.
 */
export async function cleanupSeedPlayersFromOpenRosters(): Promise<CleanupOpenRostersResult> {
  if (!isSupabaseServerConfigured()) {
    throw new Error(
      'SUPABASE_SECRET_KEY non configurata: impossibile pulire le rose'
    );
  }

  const supabase = getServerClient();
  const now = new Date().toISOString();

  // Prefer SQL RPC when available
  const { data: rpcData, error: rpcError } = await supabase.rpc(
    'cleanup_seed_players_from_open_rosters'
  );
  if (!rpcError && rpcData) {
    const detail = await readOpenRosterCountsByTeam();
    return {
      seedRemovedFromOpenRosters: Number(
        (rpcData as CleanupOpenRostersResult).seedRemovedFromOpenRosters ?? 0
      ),
      playersDeactivated: Number(
        (rpcData as CleanupOpenRostersResult).playersDeactivated ?? 0
      ),
      playersActive: Number(
        (rpcData as CleanupOpenRostersResult).playersActive ?? 0
      ),
      openRosterPlayers: Number(
        (rpcData as CleanupOpenRostersResult).openRosterPlayers ?? 0
      ),
      teamsDetail: detail,
    };
  }

  const missing =
    rpcError?.message?.includes('Could not find the function') ||
    rpcError?.code === 'PGRST202';

  if (rpcError && !missing) {
    throw new Error(`cleanup_seed_players_from_open_rosters failed: ${rpcError.message}`);
  }

  // Service-client fallback
  const { data: openVersions, error: openError } = await supabase
    .from('roster_versions')
    .select('id')
    .is('effective_until', null);
  assertOk({ error: openError }, 'list open versions for cleanup');

  let seedRemoved = 0;
  for (const version of openVersions || []) {
    const { data: rows, error } = await supabase
      .from('roster_players')
      .select('player_id')
      .eq('roster_version_id', version.id);
    assertOk({ error }, 'list roster for cleanup');
    const seedIds = (rows || [])
      .map((r) => r.player_id)
      .filter((id) => isSeedPlayerId(id));
    if (seedIds.length === 0) continue;
    const del = await supabase
      .from('roster_players')
      .delete()
      .eq('roster_version_id', version.id)
      .in('player_id', seedIds);
    assertOk(del, 'remove seed from open roster');
    seedRemoved += seedIds.length;
  }

  const before = await supabase
    .from('players')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);
  assertOk({ error: before.error }, 'count active before cleanup');

  await reconcilePlayerActiveFlags(now);

  const after = await readRosterDbCounts();
  const teamsDetail = await readOpenRosterCountsByTeam();

  return {
    seedRemovedFromOpenRosters: seedRemoved,
    playersDeactivated: Math.max(0, (before.count ?? 0) - after.playersActive),
    playersActive: after.playersActive,
    openRosterPlayers: after.rosterPlayers,
    teamsDetail,
  };
}

export async function readOpenRosterCountsByTeam(): Promise<
  CleanupOpenRostersResult['teamsDetail']
> {
  const supabase = getServerClient();
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('id, name')
    .order('name');
  assertOk({ error: teamsError }, 'list teams');

  const detail: CleanupOpenRostersResult['teamsDetail'] = [];
  for (const team of teams || []) {
    const { data: openVersions, error: vError } = await supabase
      .from('roster_versions')
      .select('id')
      .eq('team_id', team.id)
      .is('effective_until', null)
      .order('version_number', { ascending: false })
      .limit(1);
    assertOk({ error: vError }, `open version ${team.id}`);
    const versionId = openVersions?.[0]?.id;
    if (!versionId) {
      detail.push({
        teamId: team.id,
        teamName: team.name,
        openRosterCount: 0,
      });
      continue;
    }
    const { count, error: cError } = await supabase
      .from('roster_players')
      .select('*', { count: 'exact', head: true })
      .eq('roster_version_id', versionId);
    assertOk({ error: cError }, `count open roster ${team.id}`);
    detail.push({
      teamId: team.id,
      teamName: team.name,
      openRosterCount: count ?? 0,
    });
  }
  return detail;
}

/**
 * Load active open-roster players keyed by fantasy team id (for lineup matching).
 */
export async function fetchOpenRosterPlayersForMatching(): Promise<{
  allPlayers: Player[];
  byTeamId: Record<string, Player[]>;
  aliases: FmsPlayerAlias[];
  catalog: LineupPlayerCatalogEntry[];
}> {
  if (!isSupabaseServerConfigured()) {
    throw new Error('SUPABASE_SECRET_KEY non configurata');
  }

  const supabase = getServerClient();
  const { data: openVersions, error: openError } = await supabase
    .from('roster_versions')
    .select('id, team_id')
    .is('effective_until', null);
  assertOk({ error: openError }, 'list open versions for matching');

  const byTeamId: Record<string, Player[]> = {};
  const allPlayers: Player[] = [];
  const seen = new Set<string>();

  for (const version of openVersions || []) {
    const { data: rows, error } = await supabase
      .from('roster_players')
      .select('player_id, player:players(id, name, role, real_team, is_active)')
      .eq('roster_version_id', version.id);
    assertOk({ error }, `load roster players ${version.team_id}`);

    const teamPlayers: Player[] = [];
    for (const row of rows || []) {
      const raw = row.player as
        | {
            id: string;
            name: string;
            role: PlayerRole;
            real_team: string | null;
            is_active: boolean;
          }
        | {
            id: string;
            name: string;
            role: PlayerRole;
            real_team: string | null;
            is_active: boolean;
          }[]
        | null;
      const p = Array.isArray(raw) ? raw[0] : raw;
      if (!p?.id || isSeedPlayerId(p.id)) continue;
      const player: Player = {
        id: p.id,
        name: p.name,
        role: p.role,
        teamId: version.team_id,
        realTeam: p.real_team || undefined,
      };
      teamPlayers.push(player);
      if (!seen.has(player.id)) {
        seen.add(player.id);
        allPlayers.push(player);
      }
    }
    byTeamId[version.team_id] = teamPlayers;
  }

  const rosterTeamIdsByPlayer = new Map<string, string[]>();
  for (const [teamId, players] of Object.entries(byTeamId)) {
    for (const player of players) {
      const current = rosterTeamIdsByPlayer.get(player.id) ?? [];
      current.push(teamId);
      rosterTeamIdsByPlayer.set(player.id, current);
    }
  }

  const { data: playerRows, error: playersError } = await supabase
    .from('players')
    .select('id, name, role, real_team')
    .eq('is_active', true)
    .limit(2000);
  assertOk({ error: playersError }, 'list players for lineup catalog');

  const catalog: LineupPlayerCatalogEntry[] = [];
  for (const row of playerRows || []) {
    if (!row.id || isSeedPlayerId(row.id)) continue;
    catalog.push({
      id: row.id,
      name: row.name,
      role: row.role as PlayerRole,
      realTeam: row.real_team,
      rosterTeamIds: rosterTeamIdsByPlayer.get(row.id) ?? [],
    });
  }

  const { data: aliasRows, error: aliasError } = await supabase
    .from('player_aliases')
    .select('alias, player_id, player:players(name)')
    .eq('source', FMS_ALIAS_SOURCE);
  assertOk({ error: aliasError }, 'list fms player aliases');

  const aliases: FmsPlayerAlias[] = [];
  for (const row of aliasRows || []) {
    const raw = row.player as { name: string } | { name: string }[] | null;
    const linked = Array.isArray(raw) ? raw[0] : raw;
    if (!row.alias || !row.player_id) continue;
    aliases.push({
      alias: row.alias,
      playerId: row.player_id,
      playerName: linked?.name ?? null,
    });
  }

  return { allPlayers, byTeamId, aliases, catalog };
}

export async function saveFmsPlayerAlias(
  alias: string,
  playerId: string
): Promise<void> {
  if (!isSupabaseServerConfigured()) {
    throw new Error('SUPABASE_SECRET_KEY non configurata');
  }
  const row = buildPlayerAliasInsert(alias, playerId);
  const supabase = getServerClient();
  const { error } = await supabase.from('player_aliases').upsert(
    {
      alias: row.alias,
      player_id: row.player_id,
      source: row.source,
    },
    { onConflict: 'alias,source' }
  );
  if (error) {
    throw new Error(`Salvataggio alias: ${error.message}`);
  }
}

export async function addPlayerToOpenRoster(input: {
  name: string;
  role: PlayerRole;
  realTeam: string | null;
  teamId: string;
}): Promise<Player> {
  if (!isSupabaseServerConfigured()) {
    throw new Error('SUPABASE_SECRET_KEY non configurata');
  }
  const playerName = input.name.trim();
  const teamId = input.teamId.trim();
  if (!playerName || !input.role || !teamId) {
    throw new Error('Nome, ruolo e squadra sono obbligatori');
  }

  const supabase = getServerClient();
  const now = new Date().toISOString();
  const realTeam = input.realTeam?.trim() || null;

  const { data: openVersions, error: versionError } = await supabase
    .from('roster_versions')
    .select('id')
    .eq('team_id', teamId)
    .is('effective_until', null)
    .order('version_number', { ascending: false })
    .limit(1);
  assertOk({ error: versionError }, `open roster ${teamId}`);
  const versionId = openVersions?.[0]?.id;
  if (!versionId) {
    throw new Error('Nessuna rosa attiva per questa squadra');
  }

  let lookup = supabase
    .from('players')
    .select('id')
    .eq('name', playerName)
    .eq('role', input.role);
  lookup = realTeam ? lookup.eq('real_team', realTeam) : lookup.is('real_team', null);
  const { data: matches, error: playerLookupError } = await lookup.limit(10);
  assertOk({ error: playerLookupError }, `player lookup ${playerName}`);

  let playerId = matches?.find((match) => !isSeedPlayerId(match.id))?.id as
    | string
    | undefined;

  if (!playerId) {
    playerId = `${slugifyLabel(playerName)}-${input.role.toLowerCase()}`.slice(0, 64);
    if (
      !playerId ||
      playerId === `-${input.role.toLowerCase()}` ||
      isSeedPlayerId(playerId)
    ) {
      playerId = `fms-${md5Short(`${playerName}|${input.role}|${realTeam || ''}`, 16)}`;
    } else {
      const { data: clash } = await supabase
        .from('players')
        .select('id')
        .eq('id', playerId)
        .maybeSingle();
      if (clash?.id) {
        playerId = `fms-${md5Short(`${playerName}|${input.role}|${realTeam || ''}`, 16)}`;
      }
    }

    const inserted = await supabase.from('players').insert({
      id: playerId,
      name: playerName,
      role: input.role,
      real_team: realTeam,
      is_active: true,
      updated_at: now,
    });
    assertOk(inserted, `insert player ${playerName}`);
  } else {
    const updated = await supabase
      .from('players')
      .update({
        name: playerName,
        role: input.role,
        real_team: realTeam,
        is_active: true,
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
      acquisition_price: 0,
      acquired_at: now,
    },
    { onConflict: 'roster_version_id,player_id' }
  );
  assertOk(link, `link player ${playerName}`);

  return {
    id: playerId,
    name: playerName,
    role: input.role,
    teamId,
    realTeam: realTeam || undefined,
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

  // Prefer the hardened service-client path (never reuse seed ids, open roster
  // = exactly the FMS 25, deactivate anyone not on an open roster). The SQL RPC
  // in migrations mirrors this; use it when available and fall back otherwise.
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

  // Belt-and-suspenders against older RPC deployments that could leave seed rows
  await cleanupSeedPlayersFromOpenRosters();
  const verified = await readRosterDbCounts();
  return {
    ...(data as ImportRostersCounts),
    playersActive: verified.playersActive,
    playersInactive: verified.playersInactive,
    rosterPlayers: verified.rosterPlayers,
    mode: 'rpc',
  };
}

export async function readRosterDbCounts(): Promise<{
  teams: number;
  playersActive: number;
  playersInactive: number;
  rosterPlayers: number;
}> {
  const supabase = getServerClient();

  const [teams, active, inactive] = await Promise.all([
    supabase.from('teams').select('*', { count: 'exact', head: true }),
    supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true),
    supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', false),
  ]);

  for (const res of [teams, active, inactive]) {
    if (res.error) throw new Error(res.error.message);
  }

  // Count only open-roster links (effective_until IS NULL)
  const openRostered = await listOpenRosterPlayerIds();

  return {
    teams: teams.count ?? 0,
    playersActive: active.count ?? 0,
    playersInactive: inactive.count ?? 0,
    rosterPlayers: openRostered.size,
  };
}
