/**
 * Lineup utilities - server-safe functions that don't use browser APIs
 */

import { Lineup, LineupSlot, PlayerRole } from '@/types';
import { getTeamById, getPlayerById } from '@/data/teams';

const ALLOWED_FORMATIONS = [
  '6-3-1',
  '5-3-2',
  '5-4-1',
  '4-5-1',
  '4-4-2',
  '4-3-3',
  '3-6-1',
  '3-5-2',
  '3-4-3',
];

export function isAllowedFormation(formation: string): boolean {
  return ALLOWED_FORMATIONS.includes(formation);
}

export function inferFormationFromStarters(starterPlayerIds: string[]): string {
  const counts: Record<PlayerRole, number> = { P: 0, D: 0, C: 0, A: 0 };
  for (const id of starterPlayerIds) {
    const player = getPlayerById(id);
    if (player) counts[player.role] += 1;
  }
  const formation = `${counts.D}-${counts.C}-${counts.A}`;
  return isAllowedFormation(formation) ? formation : '4-4-2';
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
