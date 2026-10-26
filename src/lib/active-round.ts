/**
 * Giornata attiva (quella mostrata di default) e giornate chiuse.
 *
 * - Chiusa: la giornata ha un import voti FMS confermato (official_vote_imports
 *   source 'fms'). Risultati definitivi; annullando l'import si riapre.
 * - Attiva: per data (getCurrentRound) la giornata N diventa attiva solo al primo
 *   calcio d'inizio di Serie A della giornata N (serie_a_matches.kickoff_time);
 *   fino ad allora resta attiva la N-1. Senza partite in DB (il cron le scrive
 *   nel giorno della giornata) si passa alla N il giorno dopo la data in calendario.
 */
import { calendar, getCurrentRound, getRoundByNumber } from '@/data/calendar';
import type { Round } from '@/types';

/** 'dd/mm/yyyy' (data di inizio, ora di Roma) -> mezzanotte del giorno dopo, ora di Roma. */
function dayAfterRome(date: string): Date {
  const [dd, mm, yyyy] = date.split('/').map((p) => Number.parseInt(p, 10));
  // Mezzanotte di Roma = 23:00/22:00 UTC del giorno prima: usa l'offset reale di quel giorno.
  const utcGuess = Date.UTC(yyyy, mm - 1, dd + 1, 0, 0);
  const romeHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', hourCycle: 'h23' }).format(new Date(utcGuess)));
  return new Date(utcGuess - romeHour * 3600_000);
}

/**
 * Giornata attiva dato il candidato per data e il primo calcio d'inizio noto
 * della giornata candidata (null = partite non ancora in DB).
 */
export function pickActiveRound(now: Date, firstKickoff: Date | null, candidate: Round = getCurrentRound(now)): Round {
  if (candidate.number <= 1) return candidate;
  const previous = getRoundByNumber(candidate.number - 1) ?? candidate;
  if (firstKickoff) return firstKickoff.getTime() <= now.getTime() ? candidate : previous;
  return now.getTime() >= dayAfterRome(candidate.date).getTime() ? candidate : previous;
}

export interface ActiveRoundInfo {
  round: number;
  /** La giornata attiva è chiusa (import FMS confermato). */
  closed: boolean;
  closedRounds: number[];
}

export function isValidRound(n: number): boolean {
  return calendar.some((r) => r.number === n);
}
