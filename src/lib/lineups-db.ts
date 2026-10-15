/**
 * Server-side lineup persistence against Supabase.
 * Reads use public client (RLS); writes use service client + RPC.
 */

import type { Lineup } from '@/types';
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
  starterIds: string[];
  benchIds: string[];
  usePreviousLineup?: boolean;
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
      lineups.push({
        teamId: team.teamId,
        formation: base.formation,
        starters: base.starters.map((s) => s.playerId).filter(Boolean),
        bench: base.bench.map((s) => s.playerId).filter(Boolean),
      });
      continue;
    }

    const starterIds = team.starterIds.filter(Boolean);
    const benchIds = team.benchIds.filter(Boolean);
    if (starterIds.length === 0) continue;

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
