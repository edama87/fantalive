/**
 * Regole pure per giornata corrente, finestra del cron e stato giornata.
 * Usate dal cron live (/api/cron/live).
 */

import type { MatchStatus } from '@/types';
import { espnDateRange } from '@/lib/espn-live';

export const SERIE_A_MATCHES_PER_ROUND = 10;

export interface DbRoundRow {
  number: number;
  serie_a_matchday: number;
  kickoff_date: string; // YYYY-MM-DD
  status: string | null;
}

export interface DbSerieAMatchRow {
  id: string;
  status: string;
  kickoff_time: string | null;
}

/** Oggi a Roma come YYYY-MM-DD. */
export function romeTodayIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * Giornata corrente per data, non per stato: l'ultima con kickoff_date <= oggi
 * (ora di Roma), altrimenti la prima. Così uno stato sbagliato nel DB
 * (es. 'finished' a giornata in corso) non fa saltare alla successiva.
 */
export function pickCurrentRound<T extends DbRoundRow>(rounds: readonly T[], todayIso: string): T | null {
  const sorted = [...rounds].sort((a, b) => a.kickoff_date.localeCompare(b.kickoff_date) || a.number - b.number);
  let current: T | null = sorted[0] ?? null;
  for (const round of sorted) {
    if (round.kickoff_date <= todayIso) current = round;
  }
  return current;
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

/**
 * Giorni (yyyymmdd) in cui si gioca la giornata di Serie A: dal primo giorno
 * fino al giorno prima della giornata successiva, al massimo 5 giorni.
 */
export function roundEspnDates(round: DbRoundRow, nextRound: DbRoundRow | null): string[] {
  let days = 5;
  if (nextRound) days = Math.min(days, daysBetween(round.kickoff_date, nextRound.kickoff_date));
  return espnDateRange(round.kickoff_date, Math.max(1, days));
}

/**
 * Stato giornata dalle partite di Serie A: 'finished' solo se tutte le partite
 * attese sono finite, 'live' se almeno una è iniziata, altrimenti 'scheduled'.
 */
export function deriveRoundStatus(
  statuses: readonly string[],
  expected: number = SERIE_A_MATCHES_PER_ROUND
): 'scheduled' | 'live' | 'finished' {
  const finished = statuses.filter((status) => status === 'finished').length;
  if (statuses.length >= expected && finished === statuses.length) return 'finished';
  if (statuses.some((status) => status !== 'scheduled')) return 'live';
  return 'scheduled';
}

/**
 * Il cron lavora se: mancano partite della giornata nel DB (da caricare),
 * c'è una partita live/intervallo, o una partita non finita è tra -15' e
 * +150' dal calcio d'inizio.
 */
export function cronWindow(
  matches: readonly DbSerieAMatchRow[],
  now: Date,
  inRoundDays: boolean,
  expected: number = SERIE_A_MATCHES_PER_ROUND
): { active: boolean; reason: string } {
  // Partite mancanti: le carichiamo solo nei giorni della giornata (evita
  // chiamate ogni minuto per giorni se una partita è rinviata).
  if (matches.length < expected && inRoundDays) return { active: true, reason: 'fixtures_missing' };
  if (matches.some((m) => m.status === 'live' || m.status === 'halftime')) {
    return { active: true, reason: 'live_match_in_progress' };
  }
  for (const match of matches) {
    if (match.status === 'finished' || !match.kickoff_time) continue;
    const diff = Date.parse(match.kickoff_time) - now.getTime();
    if (diff <= 15 * 60_000 && diff >= -150 * 60_000) return { active: true, reason: 'match_within_window' };
  }
  return { active: false, reason: 'outside_match_window' };
}

export function isStartedStatus(status: string | null | undefined): status is MatchStatus {
  return status === 'live' || status === 'halftime' || status === 'finished';
}
