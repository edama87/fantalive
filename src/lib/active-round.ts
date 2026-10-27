/**
 * Giornata attiva (quella mostrata di default) e giornate chiuse.
 *
 * - Chiusa: la giornata ha un import voti FMS confermato (official_vote_imports
 *   source 'fms'). Risultati definitivi; annullando l'import si riapre.
 * - Attiva: per data (getCurrentRound) la giornata N diventa attiva 3 ore prima
 *   del primo calcio d'inizio di Serie A della giornata N (serie_a_matches o,
 *   se il cron non le ha ancora scritte, calendario fantacalcio.it); fino ad
 *   allora resta attiva la N-1. Senza orari noti si passa alla N il giorno
 *   dopo la data in calendario.
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

/** Anticipo del passaggio alla nuova giornata rispetto al primo calcio d'inizio. */
export const ROUND_SWITCH_LEAD_MS = 3 * 3600_000;

/** "2026-10-27T18:30" (ora di Roma) -> Date. */
export function romeLocalToDate(local: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(guess));
  const [rh, rm] = parts.split(':').map(Number);
  const offsetMin = (rh * 60 + rm) - (h * 60 + mi);
  const norm = ((offsetMin + 720) % 1440 + 1440) % 1440 - 720;
  return new Date(guess - norm * 60_000);
}

/**
 * Giornata attiva dato il candidato per data e il primo calcio d'inizio noto
 * della giornata candidata (null = partite non ancora in DB).
 */
export function pickActiveRound(now: Date, firstKickoff: Date | null, candidate: Round = getCurrentRound(now)): Round {
  if (candidate.number <= 1) return candidate;
  const previous = getRoundByNumber(candidate.number - 1) ?? candidate;
  if (firstKickoff) return firstKickoff.getTime() - ROUND_SWITCH_LEAD_MS <= now.getTime() ? candidate : previous;
  return now.getTime() >= dayAfterRome(candidate.date).getTime() ? candidate : previous;
}

export interface ActiveRoundInfo {
  round: number;
  /** La giornata attiva è chiusa (import FMS confermato). */
  closed: boolean;
  closedRounds: number[];
  /** Giornata successiva e quando diventa attiva (ISO, 3h prima del primo calcio d'inizio). */
  nextRound?: number | null;
  nextSwitchAt?: string | null;
}

export function isValidRound(n: number): boolean {
  return calendar.some((r) => r.number === n);
}
