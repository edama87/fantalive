import type { LineupMap } from '@/lib/lineups-db';

/** Stato del giocatore nella FantaSquadra proprietaria per la giornata (come "Partite da seguire"). */
export type OwnerStatus = 'starter' | 'bench' | 'out';

export interface PlayerOwner {
  teamId: string;
  status: OwnerStatus;
}

/**
 * Proprietario di ogni giocatore: prima la formazione della giornata (titolare /
 * panchina), poi la rosa aperta (tribuna o nessuna formazione). Svincolati assenti.
 */
export function buildPlayerOwners(
  lineups: LineupMap,
  rosters: ReadonlyArray<{ teamId: string; playerIds: readonly string[] }>,
): Map<string, PlayerOwner> {
  const owners = new Map<string, PlayerOwner>();
  for (const lineup of Object.values(lineups)) {
    for (const s of lineup.starters) if (s.playerId) owners.set(s.playerId, { teamId: lineup.teamId, status: 'starter' });
    for (const s of lineup.bench) if (s.playerId && !owners.has(s.playerId)) owners.set(s.playerId, { teamId: lineup.teamId, status: 'bench' });
  }
  for (const r of rosters) for (const id of r.playerIds) if (!owners.has(id)) owners.set(id, { teamId: r.teamId, status: 'out' });
  return owners;
}
