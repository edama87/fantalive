'use client';

import { Lineup, Player } from '@/types';
import {
  generateDefaultLineup,
  inferFormationFromStarters,
  isAllowedFormation,
} from './lineup-utils';
import type { ImportedLineupInput, LineupMap } from './lineups-db';

export { generateDefaultLineup, inferFormationFromStarters, isAllowedFormation };
export type { LineupMap, ImportedLineupInput };

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

/** @deprecated Prefer createLineupProviderFromMap after fetchLineups */
export function createLineupProvider(
  lineups: LineupMap = {}
): (teamId: string, roundNumber: number) => Lineup {
  return createLineupProviderFromMap(lineups);
}

export async function fetchLineupBundle(
  roundNumber: number
): Promise<{ lineups: LineupMap; players: Record<string, Player> }> {
  const res = await fetch(`/api/lineups?round=${roundNumber}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `fetchLineups failed (${res.status})`);
  }
  const body = await res.json();
  return {
    lineups: (body.lineups || {}) as LineupMap,
    players: (body.players || {}) as Record<string, Player>,
  };
}

export async function fetchLineups(roundNumber: number): Promise<LineupMap> {
  const bundle = await fetchLineupBundle(roundNumber);
  return bundle.lineups;
}

export async function saveImportedLineups(
  roundNumber: number,
  teams: ImportedLineupInput[]
): Promise<number> {
  const res = await fetch('/api/admin/lineups/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roundNumber, teams }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success) {
    throw new Error(body.error || `Salvataggio formazioni fallito (${res.status})`);
  }

  return Number(body.lineupsSaved ?? body.lineupsInDb ?? 0);
}
