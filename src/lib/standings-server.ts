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

type RoundComputed = {
  round: number;
  matches: FantasyMatchResult[];
  isLive: boolean;
  closed: boolean;
};

async function computeRounds(upto: number, simulate?: boolean): Promise<RoundComputed[]> {
  const numbers = Array.from({ length: Math.max(0, upto) }, (_, i) => i + 1);
  return Promise.all(
    numbers.map(async (round) => ({
      round,
      ...(await computeRoundMatches(round, { simulate }).catch(() => ({
        matches: [] as FantasyMatchResult[],
        isLive: false,
        closed: false,
      }))),
    })),
  );
}

export async function getStandingsAfterRound(
  requested?: number | null,
  opts: { simulate?: boolean } = {},
): Promise<StandingsAfterRound> {
  const maxRound = (await getActiveRound()).number;

  // Con giornata scelta: calcola solo 1..N (non le successive).
  // Senza: serve scandire fino a maxRound per trovare l'ultima giocata.
  const needUpto =
    requested != null && requested > 0 ? Math.min(requested, maxRound) : maxRound;
  const computed = await computeRounds(needUpto, opts.simulate);

  const played = lastPlayedRound(computed);
  const round =
    requested != null && requested > 0 && requested <= maxRound ? Math.min(requested, maxRound) : played;
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
    standings: withPositionChange(
      accumulateStandings(included),
      round > 1 ? accumulateStandings(included.filter((r) => r.round < round)) : null,
    ),
    matches,
  };
}
