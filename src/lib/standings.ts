/**
 * Classifica cumulata: somma i risultati delle giornate 1..N.
 * Conta le sfide finite (e, per la giornata in corso, quelle live/intervallo,
 * segnalate come parziali). Ordine: punti, fantapunti totali, gol fatti.
 */
import type { FantasyMatchResult } from '@/types';
import { teams } from '@/data/teams';

export interface CumulativeStandingsEntry {
  teamId: string;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  /** Somma dei punteggi totali di squadra (fantapunti). */
  fantaTotal: number;
  /** Risultato della giornata N se è ancora in corso. */
  live?: { opponentId: string; goalsFor: number; goalsAgainst: number };
}

export interface RoundMatches {
  round: number;
  matches: FantasyMatchResult[];
}

const COUNTED = new Set(['finished', 'live', 'halftime']);

/** Sfida iniziata e con entrambe le formazioni (senza formazioni non c'è risultato). */
export function isCountable(m: FantasyMatchResult): boolean {
  return COUNTED.has(m.status) && m.homePlayerScores.length > 0 && m.awayPlayerScores.length > 0;
}

export function emptyStandings(): CumulativeStandingsEntry[] {
  return teams.map((t) => ({
    teamId: t.id, teamName: t.name, played: 0, won: 0, drawn: 0, lost: 0,
    goalsFor: 0, goalsAgainst: 0, points: 0, fantaTotal: 0,
  }));
}

export function accumulateStandings(rounds: RoundMatches[]): CumulativeStandingsEntry[] {
  const table = new Map(emptyStandings().map((e) => [e.teamId, e]));
  const lastRound = Math.max(0, ...rounds.map((r) => r.round));
  for (const { round, matches } of rounds) {
    for (const m of matches) {
      if (!isCountable(m)) continue;
      const sides = [
        [m.homeTeamId, m.awayTeamId, m.homeGoals, m.awayGoals, m.homeTotal],
        [m.awayTeamId, m.homeTeamId, m.awayGoals, m.homeGoals, m.awayTotal],
      ] as const;
      for (const [id, opp, gf, ga, total] of sides) {
        const e = table.get(id);
        if (!e) continue;
        e.played += 1;
        e.goalsFor += gf;
        e.goalsAgainst += ga;
        e.fantaTotal = Math.round((e.fantaTotal + total) * 100) / 100;
        if (gf > ga) { e.won += 1; e.points += 3; }
        else if (gf === ga) { e.drawn += 1; e.points += 1; }
        else e.lost += 1;
        if (round === lastRound && m.status !== 'finished') e.live = { opponentId: opp, goalsFor: gf, goalsAgainst: ga };
      }
    }
  }
  return sortStandings([...table.values()]);
}

export function sortStandings(entries: CumulativeStandingsEntry[]): CumulativeStandingsEntry[] {
  return entries.sort((a, b) =>
    b.points - a.points ||
    b.fantaTotal - a.fantaTotal ||
    b.goalsFor - a.goalsFor ||
    (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) ||
    a.teamName.localeCompare(b.teamName),
  );
}

/** Ultima giornata con almeno una sfida iniziata (0 se nessuna). */
export function lastPlayedRound(rounds: RoundMatches[]): number {
  let last = 0;
  for (const r of rounds) if (r.matches.some(isCountable)) last = Math.max(last, r.round);
  return last;
}

/** "?giornata=N" -> N valido in [1, max], altrimenti null. */
export function parseGiornata(value: string | string[] | null | undefined, max: number): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 && n <= max ? n : null;
}
