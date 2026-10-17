/**
 * Partite di Serie A della giornata (da serie_a_matches), utilizzabili anche
 * lato client: stato per squadra e etichetta tipo "FRO-SAS 4-2 finita".
 */

import type { MatchStatus } from '@/types';

const TEAM_CODES: Record<string, string> = {
  atalanta: 'ATA',
  bologna: 'BOL',
  cagliari: 'CAG',
  como: 'COM',
  fiorentina: 'FIO',
  frosinone: 'FRO',
  genoa: 'GEN',
  inter: 'INT',
  internazionale: 'INT',
  juventus: 'JUV',
  lazio: 'LAZ',
  lecce: 'LEC',
  milan: 'MIL',
  'ac milan': 'MIL',
  monza: 'MON',
  napoli: 'NAP',
  parma: 'PAR',
  roma: 'ROM',
  'as roma': 'ROM',
  sassuolo: 'SAS',
  torino: 'TOR',
  udinese: 'UDI',
  venezia: 'VEN',
  verona: 'VER',
  pisa: 'PIS',
  cremonese: 'CRE',
};

/** "Frosinone" -> "FRO"; un codice già valido resta com'è. */
export function serieATeamCode(name: string | null | undefined): string | null {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  const key = trimmed.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (TEAM_CODES[key]) return TEAM_CODES[key];
  if (/^[A-Za-z]{3}$/.test(trimmed)) return trimmed.toUpperCase();
  return trimmed.slice(0, 3).toUpperCase();
}

export interface RoundFixture {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  homeCode: string;
  awayCode: string;
  homeScore: number;
  awayScore: number;
  status: MatchStatus;
  minute: number;
  kickoffTime: string | null;
}

export interface SerieAMatchRow {
  id: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
  minute: number | null;
  kickoff_time: string | null;
}

function toStatus(value: string): MatchStatus {
  return value === 'live' || value === 'halftime' || value === 'finished' ? value : 'scheduled';
}

export function fixtureFromRow(row: SerieAMatchRow): RoundFixture {
  return {
    matchId: row.id,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    homeCode: serieATeamCode(row.home_team) ?? row.home_team,
    awayCode: serieATeamCode(row.away_team) ?? row.away_team,
    homeScore: row.home_score ?? 0,
    awayScore: row.away_score ?? 0,
    status: toStatus(row.status),
    minute: row.minute ?? 0,
    kickoffTime: row.kickoff_time,
  };
}

export function teamStatusesFromFixtures(fixtures: readonly RoundFixture[]): Map<string, MatchStatus> {
  const map = new Map<string, MatchStatus>();
  for (const fixture of fixtures) {
    map.set(fixture.homeCode, fixture.status);
    map.set(fixture.awayCode, fixture.status);
  }
  return map;
}

export function fixtureForTeam(
  fixtures: readonly RoundFixture[],
  teamCode: string | null | undefined
): RoundFixture | null {
  const code = serieATeamCode(teamCode);
  if (!code) return null;
  return fixtures.find((f) => f.homeCode === code || f.awayCode === code) ?? null;
}

const WEEKDAYS: Record<string, string> = {
  Sun: 'dom', Mon: 'lun', Tue: 'mar', Wed: 'mer', Thu: 'gio', Fri: 'ven', Sat: 'sab',
};

/** Giorno e ora del calcio d'inizio a Roma, es. "sab 15:00". */
export function romeKickoff(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Rome',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${WEEKDAYS[get('weekday')] ?? get('weekday')} ${get('hour')}:${get('minute')}`;
}

/**
 * "FRO-SAS 4-2 finita", "FRO-SAS 1-0 in corso 63′", "FRO-SAS 1-0 intervallo",
 * "FRO-SAS da giocare sab 15:00".
 */
export function fixtureLabel(fixture: RoundFixture): string {
  const teams = `${fixture.homeCode}-${fixture.awayCode}`;
  const score = `${fixture.homeScore}-${fixture.awayScore}`;
  switch (fixture.status) {
    case 'finished':
      return `${teams} ${score} finita`;
    case 'halftime':
      return `${teams} ${score} intervallo`;
    case 'live':
      return `${teams} ${score} in corso${fixture.minute ? ` ${fixture.minute}′` : ''}`;
    default:
      return fixture.kickoffTime ? `${teams} da giocare ${romeKickoff(fixture.kickoffTime)}` : `${teams} da giocare`;
  }
}
