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

export type LineupPlayerRoleRef = { role: PlayerRole };

/**
 * Confronta titolari e panchina (stessi id nello stesso ordine).
 * Serve a segnalare una formazione FMS identica alla precedente (possibile ripresa automatica).
 */
export function lineupsHaveSamePlayers(a: Lineup, b: Lineup): boolean {
  const ids = (slots: Lineup['starters']) =>
    [...slots].sort((x, y) => x.position - y.position).map((s) => s.playerId);
  const aS = ids(a.starters);
  const bS = ids(b.starters);
  const aB = ids(a.bench);
  const bB = ids(b.bench);
  return aS.length === bS.length && aB.length === bB.length
    && aS.every((id, i) => id === bS[i])
    && aB.every((id, i) => id === bB[i]);
}

/**
 * Riprende un'ultima formazione valida sulla rosa effettiva della giornata:
 * toglie chi non è più in rosa e riempie i buchi dalla panchina precedente
 * (stesso ruolo) o dal resto della rosa.
 */
export function adaptLineupToRoster(
  previous: Lineup,
  rosterIds: ReadonlySet<string>,
  options: {
    playersById?: Record<string, LineupPlayerRoleRef>;
    roundNumber?: number;
    teamId?: string;
    notSubmitted?: boolean;
  } = {},
): Lineup {
  const teamId = options.teamId ?? previous.teamId;
  const roundNumber = options.roundNumber ?? previous.roundNumber;
  const roleOf = (id: string): PlayerRole | undefined =>
    options.playersById?.[id]?.role;

  const prevStarters = [...previous.starters].sort((a, b) => a.position - b.position);
  const prevBench = [...previous.bench].sort((a, b) => a.position - b.position);
  const used = new Set<string>();
  const starters: LineupSlot[] = [];
  const droppedRoles: Array<PlayerRole | undefined> = [];

  for (const slot of prevStarters) {
    if (rosterIds.has(slot.playerId)) {
      starters.push({ playerId: slot.playerId, position: starters.length });
      used.add(slot.playerId);
    } else {
      droppedRoles.push(roleOf(slot.playerId));
    }
  }

  const takeReplacement = (wantedRole?: PlayerRole): string | null => {
    const pools = [
      prevBench.map((s) => s.playerId),
      [...rosterIds],
    ];
    const preferRole = (needRole: PlayerRole | undefined) => {
      for (const pool of pools) {
        for (const id of pool) {
          if (used.has(id) || !rosterIds.has(id)) continue;
          if (needRole && roleOf(id) && roleOf(id) !== needRole) continue;
          used.add(id);
          return id;
        }
      }
      return null;
    };
    return preferRole(wantedRole) ?? (wantedRole ? preferRole(undefined) : null);
  };

  for (const role of droppedRoles) {
    const replacement = takeReplacement(role);
    if (!replacement) continue;
    starters.push({ playerId: replacement, position: starters.length });
  }

  // Keep a conventional 11 if we still have room and players left (same role gaps only already filled).
  const bench: LineupSlot[] = [];
  for (const slot of prevBench) {
    if (!rosterIds.has(slot.playerId) || used.has(slot.playerId)) continue;
    bench.push({ playerId: slot.playerId, position: bench.length });
    used.add(slot.playerId);
  }

  const counts: Record<PlayerRole, number> = { P: 0, D: 0, C: 0, A: 0 };
  for (const slot of starters) {
    const role = roleOf(slot.playerId);
    if (role) counts[role] += 1;
  }
  const inferred = `${counts.D}-${counts.C}-${counts.A}`;
  const formation = isAllowedFormation(inferred) ? inferred : previous.formation;

  return {
    teamId,
    roundNumber,
    formation,
    starters,
    bench,
    notSubmitted: options.notSubmitted ?? true,
  };
}
