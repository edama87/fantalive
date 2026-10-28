/**
 * Classifica "dopo la giornata N" calcolata dai risultati delle giornate 1..N
 * (voti e formazioni dal DB). Senza N: l'ultima giornata iniziata con risultati.
 */
import type { FantasyMatchResult } from '@/types';
import { getActiveRound } from '@/lib/active-round-server';
import { computeRoundMatches } from '@/lib/round-matches-server';
import { accumulateStandings, isCountable, lastPlayedRound, withPositionChange, type CumulativeStandingsEntry } from '@/lib/standings';

export interface StandingsAfterRound {
  /** Giornata a cui si riferisce la classifica (0 = nessuna giocata). */
  round: number;
  /** Ultima giornata selezionabile (quella in corso). */
  maxRound: number;
  /** La giornata N è ancora in corso: classifica parziale. */
  partial: boolean;
  /** La giornata N è chiusa (import voti FMS confermato). */
  closed: boolean;
  isLive: boolean;
  standings: CumulativeStandingsEntry[];
  /** Sfide della giornata N (per i risultati). */
  matches: FantasyMatchResult[];
}

export async function getStandingsAfterRound(requested?: number | null, opts: { simulate?: boolean } = {}): Promise<StandingsAfterRound> {
  const maxRound = (await getActiveRound()).number;
  const numbers = Array.from({ length: maxRound }, (_, i) => i + 1);
  const computed = await Promise.all(
    numbers.map(async (round) => ({ round, ...(await computeRoundMatches(round, { simulate: opts.simulate }).catch(() => ({ matches: [], isLive: false, closed: false }))) })),
  );
  const played = lastPlayedRound(computed);
  const round = requested && requested <= maxRound ? requested : played;
  const included = computed.filter((r) => r.round <= round);
  const target = computed.find((r) => r.round === round);
  const matches = target?.matches ?? [];
  const closed = Boolean(target?.closed);
  const partial = !closed && matches.some(isCountable) && !matches.every((m) => m.status === 'finished');
  return {
    round,
    maxRound,
    partial,
    closed,
    isLive: Boolean(target?.isLive),
    // Variazioni rispetto alla classifica dopo la giornata precedente (anche se N è in corso).
    standings: withPositionChange(
      accumulateStandings(included),
      round > 1 ? accumulateStandings(included.filter((r) => r.round < round)) : null,
    ),
    matches,
  };
}
