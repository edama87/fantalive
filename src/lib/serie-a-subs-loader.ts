import { normalizeEspnTeamName, parseEspnScoreboard, type EspnScoreboard, type EspnSummary } from '@/lib/espn-live';
import type { FantacalcioCalendarMatch } from '@/lib/fantacalcio-it';
import { espnClockLabel } from '@/lib/match-clock';
import { extractEspnSubstitutions, type EspnSubstitution } from '@/lib/serie-a-subs';

const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1';

const norm = (name: string) =>
  normalizeEspnTeamName(name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return (await response.json()) as T;
}

/**
 * Cambi (con minuto) della partita da ESPN. Best effort: se ESPN non
 * risponde o non trova la partita, lista vuota e la pagina usa l'ordine
 * di fantacalcio.it senza minuti.
 */
export async function loadEspnSubstitutions(match: FantacalcioCalendarMatch): Promise<EspnSubstitution[]> {
  if (match.status === 'scheduled' || !match.kickoffTime) return [];
  const date = match.kickoffTime.slice(0, 10).replaceAll('-', '');
  if (!/^\d{8}$/.test(date)) return [];
  try {
    const scoreboard = await getJson<EspnScoreboard>(`${ESPN_BASE_URL}/scoreboard?dates=${date}`);
    const espnMatch = parseEspnScoreboard(scoreboard).find(
      (m) => norm(m.homeTeam) === norm(match.homeTeam) && norm(m.awayTeam) === norm(match.awayTeam)
    );
    if (!espnMatch) return [];
    const summary = await getJson<EspnSummary>(`${ESPN_BASE_URL}/summary?event=${espnMatch.matchId}`);
    return extractEspnSubstitutions(summary);
  } catch (error) {
    console.warn('[Serie A] cambi ESPN non disponibili:', error);
    return [];
  }
}

/**
 * Minuto, stato e risultato live da ESPN per le partite in corso del
 * calendario fantacalcio.it (che non riporta il minuto). Best effort.
 */
export async function withEspnClock(matches: FantacalcioCalendarMatch[]): Promise<FantacalcioCalendarMatch[]> {
  const active = matches.filter((m) => (m.status === 'live' || m.status === 'halftime') && m.kickoffTime);
  const dates = [...new Set(active.map((m) => m.kickoffTime!.slice(0, 10).replaceAll('-', '')).filter((d) => /^\d{8}$/.test(d)))];
  if (dates.length === 0) return matches;
  try {
    const espn = (await Promise.all(dates.map((d) => getJson<EspnScoreboard>(`${ESPN_BASE_URL}/scoreboard?dates=${d}`)))).flatMap(parseEspnScoreboard);
    return mergeEspnClock(matches, espn);
  } catch (error) {
    console.warn('[Serie A] minuto ESPN non disponibile:', error);
    return matches;
  }
}

export function mergeEspnClock(
  matches: FantacalcioCalendarMatch[],
  espn: ReturnType<typeof parseEspnScoreboard>
): FantacalcioCalendarMatch[] {
  return matches.map((match) => {
    if (match.status !== 'live' && match.status !== 'halftime') return match;
    const e = espn.find((m) => norm(m.homeTeam) === norm(match.homeTeam) && norm(m.awayTeam) === norm(match.awayTeam));
    if (!e || e.status === 'scheduled') return match;
    const clock = e.status === 'live' ? espnClockLabel(e.displayClock) : null;
    return {
      ...match,
      status: e.status,
      minute: e.status === 'live' ? e.minute || match.minute : match.minute,
      ...(clock ? { clock } : {}),
      homeScore: Math.max(match.homeScore ?? 0, e.homeScore),
      awayScore: Math.max(match.awayScore ?? 0, e.awayScore),
    };
  });
}
