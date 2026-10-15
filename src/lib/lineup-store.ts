'use client';

import { Lineup } from '@/types';
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

export async function fetchLineups(roundNumber: number): Promise<LineupMap> {
  const res = await fetch(`/api/lineups?round=${roundNumber}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `fetchLineups failed (${res.status})`);
  }
  const body = await res.json();
  return (body.lineups || {}) as LineupMap;
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
