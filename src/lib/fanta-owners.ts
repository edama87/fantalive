import type { LineupMap } from '@/lib/lineups-db';

/** Stato del giocatore nella FantaSquadra proprietaria per la giornata (come "Partite da seguire"). */
export type OwnerStatus = 'starter' | 'bench' | 'out';

export interface PlayerOwner {
  teamId: string;
  status: OwnerStatus;
  /** Panchinaro entrato in automatico: nome del titolare sostituito. */
  subIn?: string;
  /** Titolare sostituito in automatico (s.v. certo): nome di chi è entrato. */
  subOut?: string;
}

/** Cambi automatici del motore di punteggio (stesse coppie della sfida). */
export type TeamReplacements = Record<string, ReadonlyArray<{ starterId: string; benchId: string }>>;

/**
 * Proprietario di ogni giocatore: prima la formazione della giornata (titolare /
 * panchina, con i cambi automatici), poi la rosa aperta (tribuna o nessuna
 * formazione). Svincolati assenti.
 */
export function buildPlayerOwners(
  lineups: LineupMap,
  rosters: ReadonlyArray<{ teamId: string; playerIds: readonly string[] }>,
  replacements: TeamReplacements = {},
  playerName: (id: string) => string = (id) => id,
): Map<string, PlayerOwner> {
  const owners = new Map<string, PlayerOwner>();
  for (const lineup of Object.values(lineups)) {
    for (const s of lineup.starters) if (s.playerId) owners.set(s.playerId, { teamId: lineup.teamId, status: 'starter' });
    for (const s of lineup.bench) if (s.playerId && !owners.has(s.playerId)) owners.set(s.playerId, { teamId: lineup.teamId, status: 'bench' });
    for (const { starterId, benchId } of replacements[lineup.teamId] ?? []) {
      owners.set(benchId, { teamId: lineup.teamId, status: 'starter', subIn: playerName(starterId) });
      owners.set(starterId, { teamId: lineup.teamId, status: 'bench', subOut: playerName(benchId) });
    }
  }
  for (const r of rosters) for (const id of r.playerIds) if (!owners.has(id)) owners.set(id, { teamId: r.teamId, status: 'out' });
  return owners;
}
