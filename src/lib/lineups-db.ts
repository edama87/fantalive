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
  generateDefaultLineup,
  inferFormationFromStarters,
  isAllowedFormation,
} from '@/lib/lineup-utils';

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
    };
  }
  return map;
}

export async function fetchLineupsForRound(roundNumber: number): Promise<LineupMap> {
  const supabase = getPublicClient();
  const { data, error } = await supabase
    .from('lineups')
    .select(
      `
      team_id,
      round_number,
      formation,
      lineup_slots ( player_id, slot_type, position )
    `
    )
    .eq('round_number', roundNumber);

  if (error) throw new Error(`fetchLineupsForRound: ${error.message}`);
  return mapDbLineupsToMap((data || []) as LineupRow[]);
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
  for (let offset = 0; offset < unique.length; offset += 100) {
    const chunk = unique.slice(offset, offset + 100);
    const { data, error } = await supabase
      .from('players')
      .select('id, name, role, real_team')
      .in('id', chunk);
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
