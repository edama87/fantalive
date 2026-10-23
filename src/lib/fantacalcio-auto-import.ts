/**
 * Import automatico dei voti fantacalcio.it dal cron live.
 *
 * - Al massimo ogni 2 minuti (ultimo run 'fantacalcio_votes' in cron_runs).
 * - Solo partite in corso o finite da poco (calcio d'inizio nelle ultime 6 ore).
 * - Una richiesta per partita attiva per run (il calendario della giornata resta
 *   in memoria 15 minuti), timeout per richiesta, errori isolati per partita.
 * - Scrive con saveFantacalcioOfficialVotes, che salta i voti consolidati
 *   (pianetafanta); il trigger DB official_votes_keep_consolidated fa da rete.
 */

import { resolveMatchVotes } from '@/lib/fantacalcio-live';
import {
  canonicalTeamCode,
  fantacalcioCalendarUrl,
  normalizePlayerName,
  parseFantacalcioCalendar,
  parseFantacalcioVotes,
  type FantacalcioAlias,
  type FantacalcioCalendarMatch,
  type FantacalcioCatalogPlayer,
} from '@/lib/fantacalcio-it';
import {
  fetchFantacalcioHtml,
  matchScrapedRows,
  type FantacalcioScrapedPlayer,
} from '@/lib/fantacalcio-it-client';

export const FANTACALCIO_JOB = 'fantacalcio_votes';
export const FANTACALCIO_MIN_INTERVAL_MS = 2 * 60_000;
/** Margine: il cron gira ogni minuto, con 2 min esatti salteremmo a 3. */
const INTERVAL_SLACK_MS = 15_000;
export const FANTACALCIO_RECENT_HOURS = 6;
const REQUEST_TIMEOUT_MS = 8_000;
const CALENDAR_TTL_MS = 15 * 60_000;

export interface AutoImportMatch {
  id: string;
  status: string;
  kickoff_time: string | null;
  home_team?: string | null;
  away_team?: string | null;
}

/** Partite per cui ha senso leggere i voti: in corso, o finite con calcio d'inizio nelle ultime ore. */
export function activeVoteMatches<T extends AutoImportMatch>(
  matches: readonly T[],
  now: Date,
  recentHours = FANTACALCIO_RECENT_HOURS
): T[] {
  return matches.filter((match) => {
    if (match.status === 'live' || match.status === 'halftime') return true;
    if (match.status !== 'finished' || !match.kickoff_time) return false;
    const age = now.getTime() - Date.parse(match.kickoff_time);
    return age >= 0 && age <= recentHours * 3_600_000;
  });
}

export function dueForImport(lastStartedAt: string | null | undefined, now: Date): boolean {
  if (!lastStartedAt) return true;
  return now.getTime() - Date.parse(lastStartedAt) >= FANTACALCIO_MIN_INTERVAL_MS - INTERVAL_SLACK_MS;
}

const sameTeam = (a: string | null | undefined, b: string | null | undefined) => {
  const ca = canonicalTeamCode(a);
  return ca != null && ca === canonicalTeamCode(b);
};

/** Partita del calendario fantacalcio.it corrispondente (stesse squadre). */
export function findCalendarMatch(
  calendar: readonly FantacalcioCalendarMatch[],
  match: AutoImportMatch
): FantacalcioCalendarMatch | null {
  return (
    calendar.find((item) => sameTeam(item.homeTeam, match.home_team) && sameTeam(item.awayTeam, match.away_team)) ??
    null
  );
}

export interface RosterCandidate {
  name: string;
  team: string;
  role: string | null;
  vote: number | null;
  candidates: Array<{ id: string; name: string }>;
}

/**
 * Non abbinati che probabilmente sono giocatori della lega: stesso club e
 * cognome presente nel nome di un giocatore in rosa. Gli altri (non in nessuna
 * rosa) sono normali e non vanno segnalati.
 */
export function unmatchedRosterCandidates(
  unmatched: readonly FantacalcioScrapedPlayer[],
  players: readonly FantacalcioCatalogPlayer[]
): RosterCandidate[] {
  const out: RosterCandidate[] = [];
  for (const row of unmatched) {
    const tokens = normalizePlayerName(row.name)
      .split(' ')
      .filter((token) => token.length >= 3);
    if (tokens.length === 0) continue;
    const candidates = players.filter((player) => {
      if (!sameTeam(player.realTeam, row.team)) return false;
      const playerTokens = normalizePlayerName(player.name).split(' ');
      return tokens.some((token) => playerTokens.includes(token));
    });
    if (candidates.length > 0) {
      out.push({
        name: row.name,
        team: row.team,
        role: row.role,
        vote: row.vote,
        candidates: candidates.map((player) => ({ id: player.id, name: player.name })),
      });
    }
  }
  return out;
}

const calendarCache = new Map<number, { at: number; matches: FantacalcioCalendarMatch[] }>();

async function loadCalendar(matchday: number, fetchImpl: typeof fetch, now: number) {
  const cached = calendarCache.get(matchday);
  if (cached && now - cached.at < CALENDAR_TTL_MS && cached.matches.length > 0) {
    return { matches: cached.matches, fetched: false };
  }
  const html = await fetchFantacalcioHtml(fantacalcioCalendarUrl(matchday), fetchImpl, {
    timeoutMs: REQUEST_TIMEOUT_MS,
  });
  const matches = parseFantacalcioCalendar(html);
  calendarCache.set(matchday, { at: now, matches });
  return { matches, fetched: true };
}

/** Solo per i test. */
export function resetFantacalcioCalendarCache() {
  calendarCache.clear();
}

export interface AutoImportResult {
  matches: Array<{ id: string; label: string; rows: number; matched: number; error?: string }>;
  players: FantacalcioScrapedPlayer[];
  rosterCandidates: RosterCandidate[];
  requests: number;
  errors: string[];
}

/** Legge (senza scrivere) i voti delle partite attive. */
export async function fetchActiveMatchVotes(
  serieAMatchday: number,
  active: readonly AutoImportMatch[],
  catalog: { players: readonly FantacalcioCatalogPlayer[]; aliases: readonly FantacalcioAlias[] },
  options: { fetchImpl?: typeof fetch; now?: Date } = {}
): Promise<AutoImportResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = (options.now ?? new Date()).getTime();
  const result: AutoImportResult = { matches: [], players: [], rosterCandidates: [], requests: 0, errors: [] };
  if (active.length === 0) return result;

  let calendar: FantacalcioCalendarMatch[];
  try {
    const loaded = await loadCalendar(serieAMatchday, fetchImpl, now);
    if (loaded.fetched) result.requests += 1;
    calendar = loaded.matches;
  } catch (error) {
    result.requests += 1;
    result.errors.push(`calendario: ${error instanceof Error ? error.message : String(error)}`);
    return result;
  }

  const pages = await Promise.all(
    active.map(async (match) => {
      const label = `${match.home_team ?? '?'}-${match.away_team ?? '?'}`;
      const item = findCalendarMatch(calendar, match);
      if (!item) return { id: match.id, label, rows: [] as FantacalcioScrapedPlayer[], error: 'non nel calendario fantacalcio.it' };
      result.requests += 1;
      try {
        const html = await fetchFantacalcioHtml(item.votesUrl, fetchImpl, { timeoutMs: REQUEST_TIMEOUT_MS });
        // In partita i voti non sono nell'HTML ma nel file live protobuf.
        const resolved = await resolveMatchVotes(
          html,
          parseFantacalcioVotes(html),
          { homeTeam: item.homeTeam, awayTeam: item.awayTeam, matchId: item.matchId, url: item.votesUrl },
          fetchImpl,
          { timeoutMs: REQUEST_TIMEOUT_MS }
        );
        if (resolved.source === 'live') result.requests += 2;
        return { id: match.id, label, rows: matchScrapedRows(item.matchId, resolved.players, catalog, { log: false }) };
      } catch (error) {
        return { id: match.id, label, rows: [] as FantacalcioScrapedPlayer[], error: error instanceof Error ? error.message : String(error) };
      }
    })
  );

  for (const page of pages) {
    result.players.push(...page.rows);
    result.matches.push({
      id: page.id,
      label: page.label,
      rows: page.rows.length,
      matched: page.rows.filter((row) => row.playerId).length,
      ...(page.error ? { error: page.error } : {}),
    });
    if (page.error) result.errors.push(`${page.label}: ${page.error}`);
  }
  const unmatched = result.players.filter((player) => player.playerId == null && player.vote != null);
  result.rosterCandidates = unmatchedRosterCandidates(unmatched, catalog.players);
  return result;
}
