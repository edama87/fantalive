/**
 * Classifica "dopo la giornata N" calcolata dai risultati delle giornate 1..N
 * (voti e formazioni dal DB). Senza N: l'ultima giornata iniziata con risultati.
 */
import type { FantasyMatchResult } from '@/types';
import { getCurrentRound } from '@/data/calendar';
import { computeRoundMatches } from '@/lib/round-matches-server';
import { accumulateStandings, isCountable, lastPlayedRound, type CumulativeStandingsEntry } from '@/lib/standings';

export interface StandingsAfterRound {
  /** Giornata a cui si riferisce la classifica (0 = nessuna giocata). */
  round: number;
  /** Ultima giornata selezionabile (quella in corso). */
  maxRound: number;
  /** La giornata N è ancora in corso: classifica parziale. */
  partial: boolean;
  isLive: boolean;
  standings: CumulativeStandingsEntry[];
  /** Sfide della giornata N (per i risultati). */
  matches: FantasyMatchResult[];
}

export async function getStandingsAfterRound(requested?: number | null): Promise<StandingsAfterRound> {
  const maxRound = getCurrentRound().number;
  const numbers = Array.from({ length: maxRound }, (_, i) => i + 1);
  const computed = await Promise.all(
    numbers.map(async (round) => ({ round, ...(await computeRoundMatches(round).catch(() => ({ matches: [], isLive: false }))) })),
  );
  const played = lastPlayedRound(computed);
  const round = requested && requested <= maxRound ? requested : played;
  const included = computed.filter((r) => r.round <= round);
  const target = computed.find((r) => r.round === round);
  const matches = target?.matches ?? [];
  const partial = matches.some(isCountable) && !matches.every((m) => m.status === 'finished');
  return {
    round,
    maxRound,
    partial,
    isLive: Boolean(target?.isLive),
    standings: accumulateStandings(included),
    matches,
  };
}
