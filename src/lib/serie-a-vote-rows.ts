/**
 * Righe del dettaglio voti Serie A: unisce la pagina fantacalcio.it, i cambi
 * e (se la partita è stata importata) i voti consolidati pianetafanta.
 * Dati serializzabili, passati al componente client con la modale.
 */

import type { BonusBreakdown } from '@/types';
import { fantavotoFromVote, type FantacalcioVotePlayer } from '@/lib/fantacalcio-it';
import { fantacalcioBonusBreakdown, type PlayerSubInfo } from '@/lib/serie-a-subs';
import { samePianetafantaName, type ConsolidatedVoteEntry } from '@/lib/pianetafanta-url';

export interface SerieAVoteRow {
  key: string;
  name: string;
  role: string | null;
  team: string;
  bonuses: BonusBreakdown;
  /** Voto mostrato: media consolidata o voto fantacalcio.it. */
  vote: number | null;
  fantaVote: number | null;
  /** Voti di testata quando la partita è consolidata. */
  consolidated: { gazzetta: number | null; corriere: number | null; tuttosport: number | null } | null;
  /** Voto con stima (fantacalcio.it/live), non ancora consolidato. */
  estimated: boolean;
  /** Voto fantacalcio.it originale (per confronto nella modale). */
  fantacalcioVote: number | null;
  subIn: { minute: number | null } | null;
  subOut: { minute: number | null } | null;
  /** Minuti giocati: dal file consolidato, altrimenti dedotti dai cambi; null se non noti. */
  minutesPlayed: number | null;
}

export function findConsolidatedEntry(
  entries: readonly ConsolidatedVoteEntry[],
  player: Pick<FantacalcioVotePlayer, 'name' | 'team'>
): ConsolidatedVoteEntry | null {
  const sameTeam = entries.filter((entry) => entry.team.toLowerCase() === player.team.toLowerCase());
  const pool = sameTeam.length > 0 ? sameTeam : entries;
  const hits = pool.filter((entry) => samePianetafantaName(entry.name, player.name));
  return hits.length === 1 ? hits[0] : null;
}

/** Minuti dai cambi: uscito al 74′ -> 74, entrato al 58′ -> 32, senza cambi con voto -> 90. */
export function minutesFromSubs(sub: PlayerSubInfo | undefined, hasVote: boolean): number | null {
  const inMinute = sub?.in ? sub.in.minute : undefined;
  const outMinute = sub?.out ? sub.out.minute : undefined;
  if (inMinute === null || outMinute === null) return null; // cambio senza minuto
  if (inMinute !== undefined) return Math.max(0, (outMinute ?? 90) - inMinute);
  if (outMinute !== undefined) return outMinute;
  return hasVote ? 90 : null;
}

export function buildSerieAVoteRows(
  players: readonly FantacalcioVotePlayer[],
  subs: ReadonlyMap<string, PlayerSubInfo>,
  consolidated: readonly ConsolidatedVoteEntry[] | null
): SerieAVoteRow[] {
  return players.map((player) => {
    const sub = subs.get(`${player.team}|${player.name}`);
    const official = consolidated ? findConsolidatedEntry(consolidated, player) : null;
    const vote = official ? official.average : player.vote;
    const fantaVote = official
      ? official.average == null
        ? null
        : fantavotoFromVote(official.average, player.bonuses)
      : player.fantaVote;
    return {
      key: `${player.team}|${player.name}`,
      name: player.name,
      role: player.role,
      team: player.team,
      bonuses: fantacalcioBonusBreakdown(player.bonuses),
      vote,
      fantaVote,
      consolidated: official ? { ...official.votes } : null,
      estimated: !official && vote != null,
      fantacalcioVote: player.vote,
      subIn: sub?.in ?? null,
      subOut: sub?.out ?? null,
      minutesPlayed: official?.minutesPlayed ?? minutesFromSubs(sub, vote != null),
    };
  });
}
