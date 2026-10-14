'use client';

import { Lineup, LineupSlot } from '@/types';
import { teams, getTeamById } from '@/data/teams';

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

export function generateDefaultLineup(teamId: string, roundNumber: number): Lineup {
  const team = getTeamById(teamId);
  if (!team) {
    return {
      teamId,
      roundNumber,
      formation: '4-4-2',
      starters: [],
      bench: [],
    };
  }

  const playersByRole = {
    P: team.players.filter(p => p.role === 'P'),
    D: team.players.filter(p => p.role === 'D'),
    C: team.players.filter(p => p.role === 'C'),
    A: team.players.filter(p => p.role === 'A'),
  };

  const starters: LineupSlot[] = [];
  let position = 0;

  starters.push({ playerId: playersByRole.P[0]?.id || '', position: position++ });

  for (let i = 0; i < 4 && i < playersByRole.D.length; i++) {
    starters.push({ playerId: playersByRole.D[i].id, position: position++ });
  }

  for (let i = 0; i < 4 && i < playersByRole.C.length; i++) {
    starters.push({ playerId: playersByRole.C[i].id, position: position++ });
  }

  for (let i = 0; i < 2 && i < playersByRole.A.length; i++) {
    starters.push({ playerId: playersByRole.A[i].id, position: position++ });
  }

  const starterIds = new Set(starters.map(s => s.playerId));
  const bench: LineupSlot[] = [];
  let benchPosition = 0;

  for (const player of team.players) {
    if (!starterIds.has(player.id) && benchPosition < 12) {
      bench.push({ playerId: player.id, position: benchPosition++ });
    }
  }

  return {
    teamId,
    roundNumber,
    formation: '4-4-2',
    starters,
    bench,
  };
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
