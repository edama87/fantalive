'use client';

import { Lineup } from '@/types';
import { teams } from '@/data/teams';
import {
  generateDefaultLineup,
  inferFormationFromStarters,
  isAllowedFormation,
} from './lineup-utils';

export { generateDefaultLineup, inferFormationFromStarters, isAllowedFormation };

const STORAGE_KEY = 'fantalive-lineups';

export function getStoredLineups(): Record<string, Lineup> {
  if (typeof window === 'undefined') return {};
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function saveLineup(lineup: Lineup): void {
  if (typeof window === 'undefined') return;
  
  const lineups = getStoredLineups();
  const key = `${lineup.teamId}-${lineup.roundNumber}`;
  lineups[key] = lineup;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lineups));
}

export function getLineup(teamId: string, roundNumber: number): Lineup | null {
  const lineups = getStoredLineups();
  const key = `${teamId}-${roundNumber}`;
  return lineups[key] || null;
}

export function getOrCreateLineup(teamId: string, roundNumber: number): Lineup {
  const existing = getLineup(teamId, roundNumber);
  if (existing) return existing;
  
  const defaultLineup = generateDefaultLineup(teamId, roundNumber);
  saveLineup(defaultLineup);
  return defaultLineup;
}

export function initializeAllLineups(roundNumber: number): void {
  for (const team of teams) {
    getOrCreateLineup(team.id, roundNumber);
  }
}

export function createLineupProvider(): (teamId: string, roundNumber: number) => Lineup {
  // Prefer saved (imported) lineups; fall back to default without writing to storage
  return (teamId: string, roundNumber: number) =>
    getLineup(teamId, roundNumber) || generateDefaultLineup(teamId, roundNumber);
}

export function saveImportedLineups(
  roundNumber: number,
  teams: Array<{
    teamId: string;
    formation: string | null;
    starterIds: string[];
    benchIds: string[];
    usePreviousLineup?: boolean;
  }>
): number {
  let saved = 0;
  for (const team of teams) {
    if (team.usePreviousLineup) {
      const previous =
        roundNumber > 1
          ? getLineup(team.teamId, roundNumber - 1)
          : null;
      const base = previous || generateDefaultLineup(team.teamId, roundNumber);
      saveLineup({
        ...base,
        teamId: team.teamId,
        roundNumber,
      });
      saved += 1;
      continue;
    }

    const starterIds = team.starterIds.filter(Boolean);
    const benchIds = team.benchIds.filter(Boolean);
    if (starterIds.length === 0) continue;

    const formation =
      (team.formation && isAllowedFormation(team.formation)
        ? team.formation
        : null) || inferFormationFromStarters(starterIds);

    saveLineup({
      teamId: team.teamId,
      roundNumber,
      formation,
      starters: starterIds.map((playerId, position) => ({ playerId, position })),
      bench: benchIds.map((playerId, position) => ({ playerId, position })),
    });
    saved += 1;
  }
  return saved;
}
