/**
 * Server-side lineup persistence against Supabase.
 * Reads use public client (RLS); writes use service client + RPC.
 */

import type { Lineup, Player, PlayerRole } from '@/types';
import {
  getPublicClient,
  getServerClient,
  isSupabaseServerConfigured,
} from '@/lib/db/supabase';
import {
  adaptLineupToRoster,
  generateDefaultLineup,
  inferFormationFromStarters,
  isAllowedFormation,
} from '@/lib/lineup-utils';
import { teams as fantasyTeams } from '@/data/teams';

export type LineupMap = Record<string, Lineup>;

export function lineupKey(teamId: string, roundNumber: number): string {
  return `${teamId}-${roundNumber}`;
}

export function createLineupProviderFromMap(
  lineups: LineupMap
): (teamId: string, roundNumber: number) => Lineup {
  return (teamId, roundNumber) =>
    lineups[lineupKey(teamId, roundNumber)] ||
    generateDefaultLineup(teamId, roundNumber);
}

interface LineupSlotRow {
  player_id: string;
  slot_type: 'starter' | 'bench';
  position: number;
}

interface LineupRow {
  team_id: string;
  round_number: number;
  formation: string;
  not_submitted?: boolean | null;
  lineup_slots: LineupSlotRow[] | null;
}

export function mapDbLineupsToMap(rows: LineupRow[]): LineupMap {
  const map: LineupMap = {};
  for (const row of rows) {
    const starters = (row.lineup_slots || [])
      .filter((s) => s.slot_type === 'starter')
      .sort((a, b) => a.position - b.position)
      .map((s) => ({ playerId: s.player_id, position: s.position }));

    const bench = (row.lineup_slots || [])
      .filter((s) => s.slot_type === 'bench')
      .sort((a, b) => a.position - b.position)
      .map((s) => ({ playerId: s.player_id, position: s.position }));

    map[lineupKey(row.team_id, row.round_number)] = {
      teamId: row.team_id,
      roundNumber: row.round_number,
      formation: row.formation,
      starters,
      bench,
      notSubmitted: Boolean(row.not_submitted),
    };
  }
  return map;
}


const LINEUP_SELECT_WITH_FLAG = `
      team_id,
      round_number,
      formation,
      not_submitted,
      lineup_slots ( player_id, slot_type, position )
    `;

const LINEUP_SELECT_LEGACY = `
      team_id,
      round_number,
      formation,
      lineup_slots ( player_id, slot_type, position )
    `;

async function queryLineupRows(
  apply: (select: string) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  label: string
): Promise<LineupRow[]> {
  let { data, error } = await apply(LINEUP_SELECT_WITH_FLAG);
  if (error && /not_submitted/.test(error.message)) {
    ({ data, error } = await apply(LINEUP_SELECT_LEGACY));
  }
  if (error) throw new Error(`${label}: ${error.message}`);
  return (data || []) as LineupRow[];
}

export async function fetchLineupsForRound(roundNumber: number): Promise<LineupMap> {
  const supabase = getPublicClient();
  const rows = await queryLineupRows(
    (select) => supabase.from('lineups').select(select).eq('round_number', roundNumber),
    'fetchLineupsForRound'
  );
  return mapDbLineupsToMap(rows);
}

export function playerIdsFromLineups(lineups: LineupMap): string[] {
  const ids = new Set<string>();
  for (const lineup of Object.values(lineups)) {
    for (const slot of [...lineup.starters, ...lineup.bench]) {
      if (slot.playerId) ids.add(slot.playerId);
    }
  }
  return [...ids];
}

export async function fetchPlayersByIds(
  ids: string[]
): Promise<Record<string, Player>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const players: Record<string, Player> = {};
  if (unique.length === 0) return players;

  const supabase = getPublicClient();
  const chunks: string[][] = [];
  for (let offset = 0; offset < unique.length; offset += 100) {
    chunks.push(unique.slice(offset, offset + 100));
  }
  const results = await Promise.all(
    chunks.map((chunk) =>
      supabase.from('players').select('id, name, role, real_team').in('id', chunk),
    ),
  );
  for (const { data, error } of results) {
    if (error) throw new Error(`fetchPlayersByIds: ${error.message}`);
    for (const row of data || []) {
      players[row.id] = {
        id: row.id,
        name: row.name,
        role: row.role as PlayerRole,
        teamId: '',
        realTeam: row.real_team || undefined,
      };
    }
  }
  return players;
}

export async function fetchLineup(
  teamId: string,
  roundNumber: number
): Promise<Lineup | null> {
  const map = await fetchLineupsForRound(roundNumber);
  return map[lineupKey(teamId, roundNumber)] || null;
}

export interface ImportedLineupInput {
  teamId: string;
  formation: string | null;
  starterIds: Array<string | null | undefined>;
  benchIds: Array<string | null | undefined>;
  usePreviousLineup?: boolean;
  /** Formazione non depositata: ripresa la precedente e malus −3. */
  notSubmitted?: boolean;
}

export class UnmatchedLineupPlayersError extends Error {
  readonly teamId: string;
  readonly unmatchedStarters: number;
  readonly unmatchedBench: number;

  constructor(
    teamId: string,
    unmatchedStarters: number,
    unmatchedBench: number
  ) {
    super(
      `Formazione ${teamId}: ${unmatchedStarters} titolari e ${unmatchedBench} panchinari senza match — salvataggio bloccato`
    );
    this.name = 'UnmatchedLineupPlayersError';
    this.teamId = teamId;
    this.unmatchedStarters = unmatchedStarters;
    this.unmatchedBench = unmatchedBench;
  }
}

function assertNoMissingPlayerIds(
  teamId: string,
  starterIds: Array<string | null | undefined>,
  benchIds: Array<string | null | undefined>
): { starters: string[]; bench: string[] } {
  const missingStarters = starterIds.filter((id) => !id).length;
  const missingBench = benchIds.filter((id) => !id).length;
  if (missingStarters > 0 || missingBench > 0) {
    throw new UnmatchedLineupPlayersError(
      teamId,
      missingStarters,
      missingBench
    );
  }
  return {
    starters: starterIds as string[],
    bench: benchIds as string[],
  };
}

export function buildUpsertLineupsPayload(
  roundNumber: number,
  teams: ImportedLineupInput[],
  previousByTeam: LineupMap = {}
) {
  const lineups = [];

  for (const team of teams) {
    if (team.usePreviousLineup) {
      const previous =
        roundNumber > 1
          ? previousByTeam[lineupKey(team.teamId, roundNumber - 1)]
          : null;
      const base = previous || generateDefaultLineup(team.teamId, roundNumber);
      const previousStarters = base.starters.map((s) => s.playerId);
      const previousBench = base.bench.map((s) => s.playerId);
      const { starters, bench } = assertNoMissingPlayerIds(
        team.teamId,
        previousStarters,
        previousBench
      );
      lineups.push({
        teamId: team.teamId,
        formation: base.formation,
        starters,
        bench,
        notSubmitted: team.notSubmitted ?? true,
      });
      continue;
    }

    if (team.starterIds.length === 0) continue;

    const { starters: starterIds, bench: benchIds } = assertNoMissingPlayerIds(
      team.teamId,
      team.starterIds,
      team.benchIds
    );

    const formation =
      (team.formation && isAllowedFormation(team.formation)
        ? team.formation
        : null) || inferFormationFromStarters(starterIds);

    lineups.push({
      teamId: team.teamId,
      formation,
      starters: starterIds,
      bench: benchIds,
      notSubmitted: Boolean(team.notSubmitted),
    });
  }

  return { roundNumber, lineups };
}

export async function upsertRoundLineupsViaRpc(
  roundNumber: number,
  teams: ImportedLineupInput[]
): Promise<{
  roundNumber: number;
  lineupsSaved: number;
  slotsSaved: number;
  lineupsInDb: number;
  slotsInDb: number;
}> {
  if (!isSupabaseServerConfigured()) {
    throw new Error(
      'SUPABASE_SECRET_KEY non configurata: impossibile scrivere formazioni'
    );
  }

  const previousByTeam: LineupMap = {};
  const needsPrevious = teams.some((t) => t.usePreviousLineup);
  if (needsPrevious && roundNumber > 1) {
    Object.assign(previousByTeam, await fetchLineupsForRound(roundNumber - 1));
  }

  const payload = buildUpsertLineupsPayload(roundNumber, teams, previousByTeam);
  const supabase = getServerClient();
  const { data, error } = await supabase.rpc('upsert_round_lineups', { payload });

  if (error) {
    throw new Error(`upsert_round_lineups failed: ${error.message}`);
  }

  return data as {
    roundNumber: number;
    lineupsSaved: number;
    slotsSaved: number;
    lineupsInDb: number;
    slotsInDb: number;
  };
}

/** Ultima formazione con titolari per ciascuna squadra, in una giornata precedente. */
export async function fetchLatestLineupsBefore(
  teamIds: string[],
  beforeRound: number
): Promise<Record<string, Lineup>> {
  const unique = [...new Set(teamIds.filter(Boolean))];
  const found: Record<string, Lineup> = {};
  if (unique.length === 0 || beforeRound <= 1) return found;

  const supabase = getPublicClient();
  const rows = await queryLineupRows(
    (select) =>
      supabase
        .from('lineups')
        .select(select)
        .in('team_id', unique)
        .lt('round_number', beforeRound)
        .order('round_number', { ascending: false }),
    'fetchLatestLineupsBefore'
  );
  const mapped = mapDbLineupsToMap(rows);
  for (const lineup of Object.values(mapped)) {
    if (found[lineup.teamId]) continue;
    if (!lineup.starters.length) continue;
    found[lineup.teamId] = lineup;
  }
  return found;
}

async function fetchRosterPlayerIdsForRound(
  teamIds: string[],
  roundNumber: number
): Promise<Record<string, string[]>> {
  const unique = [...new Set(teamIds.filter(Boolean))];
  const result: Record<string, string[]> = {};
  if (unique.length === 0) return result;

  const supabase = getPublicClient();
  const { data: round, error: roundError } = await supabase
    .from('rounds')
    .select('kickoff_date, kickoff_time')
    .eq('number', roundNumber)
    .maybeSingle();
  if (roundError) throw new Error(`fetchRosterPlayerIdsForRound: ${roundError.message}`);

  const { data: versions, error: verError } = await supabase
    .from('roster_versions')
    .select('id, team_id, effective_from, effective_until, version_number')
    .in('team_id', unique);
  if (verError) throw new Error(`fetchRosterPlayerIdsForRound: ${verError.message}`);

  const at = round
    ? Date.parse(`${round.kickoff_date}T${round.kickoff_time || '00:00:00'}`)
    : Date.now();

  const chosen = new Map<string, { id: string; version_number: number }>();
  for (const version of versions || []) {
    const from = version.effective_from ? Date.parse(version.effective_from) : 0;
    const until = version.effective_until ? Date.parse(version.effective_until) : Number.POSITIVE_INFINITY;
    if (from > at || until <= at) continue;
    const prev = chosen.get(version.team_id);
    if (!prev || version.version_number > prev.version_number) {
      chosen.set(version.team_id, { id: version.id, version_number: version.version_number });
    }
  }

  const versionIds = [...chosen.values()].map((v) => v.id);
  if (versionIds.length === 0) return result;

  const { data: rows, error: rpError } = await supabase
    .from('roster_players')
    .select('roster_version_id, player_id')
    .in('roster_version_id', versionIds);
  if (rpError) throw new Error(`fetchRosterPlayerIdsForRound: ${rpError.message}`);

  const byVersion = new Map<string, string[]>();
  for (const row of rows || []) {
    const list = byVersion.get(row.roster_version_id) ?? [];
    list.push(row.player_id);
    byVersion.set(row.roster_version_id, list);
  }
  for (const [teamId, version] of chosen) {
    result[teamId] = byVersion.get(version.id) ?? [];
  }
  return result;
}

/**
 * Formazioni della giornata, con fallback all'ultima valida per le squadre
 * che non hanno depositato (flag notSubmitted, da usare col malus −3).
 */
export async function fetchLineupsForRoundResolved(roundNumber: number): Promise<LineupMap> {
  const current = await fetchLineupsForRound(roundNumber);
  const teamIds = fantasyTeams.map((team) => team.id);
  const missing = teamIds.filter((id) => {
    const lineup = current[lineupKey(id, roundNumber)];
    return !lineup || lineup.starters.length === 0;
  });
  if (missing.length === 0) return current;

  const previous = await fetchLatestLineupsBefore(missing, roundNumber);
  const toAdapt = missing.filter((id) => previous[id]);
  if (toAdapt.length === 0) return current;

  let rosters: Record<string, string[]> = {};
  try {
    rosters = await fetchRosterPlayerIdsForRound(toAdapt, roundNumber);
  } catch (error) {
    console.error('[lineups] rosa effettiva non disponibile, ripeto la precedente senza filtri', error);
  }

  const playerIds = new Set<string>();
  for (const teamId of toAdapt) {
    const prev = previous[teamId];
    for (const slot of [...prev.starters, ...prev.bench]) playerIds.add(slot.playerId);
    for (const id of rosters[teamId] ?? []) playerIds.add(id);
  }
  const players = await fetchPlayersByIds([...playerIds]).catch(() => ({}));

  const resolved: LineupMap = { ...current };
  for (const teamId of toAdapt) {
    const prev = previous[teamId];
    const rosterList = rosters[teamId];
    const rosterIds = new Set(rosterList && rosterList.length > 0
      ? rosterList
      : [...prev.starters, ...prev.bench].map((s) => s.playerId));
    resolved[lineupKey(teamId, roundNumber)] = adaptLineupToRoster(prev, rosterIds, {
      playersById: players,
      roundNumber,
      teamId,
      notSubmitted: true,
    });
  }
  return resolved;
}
